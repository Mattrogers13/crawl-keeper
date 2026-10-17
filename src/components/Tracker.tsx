import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OBR from "@owlbear-rodeo/sdk";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

import Confirm from "./Confirm";
import CrawlBar, { ClockDial, FOCUS } from "./CrawlBar";
import { cryptoRand, due, rollFor } from "../crawl";
import { ChevronIcon, PlayIcon, SortIcon } from "./icons";
import Loading from "./Loading";
import RowMenu from "./RowMenu";
import Row, { INIT_SLOT, tokenInfo, type ButtonProps } from "./TrackerRow";
import { MONSTERS_FOLDED_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import type { Role } from "../hooks/useRole";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { afterTurnChange } from "../marker";
import { NO_SELECTION, clickRow, keepRows, menuTargets, type Selection } from "../selection";
import { parseSettings } from "../settings";
import { readLocal, writeLocal } from "../storage";
import { errorMessage, notify } from "../utils";
import {
  GM_ENTRY,
  gmEquation,
  moveTo,
  next,
  nextWithAutoRoll,
  parseTracker,
  playerView,
  previous,
  prune,
  removeMonsters,
  resetRounds,
  sortByRoll,
  toCombat,
  toCrawl,
  updateCrawl,
  type Entry,
  type Tracker as TrackerDoc,
} from "../tracker";

// headerSlot: where the crawl controls go (the panel's top bar); titleSlot:
// beside the title, for the round count.
const Tracker = (props: { role: Role; headerSlot?: HTMLElement | null; titleSlot?: HTMLElement | null }) => {
  const { role, headerSlot = null, titleSlot = null } = props;
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  const doc = useSceneValue(TRACKER_KEY, parseTracker);
  const items = useSceneItems();
  // Drag rows by the grip (mouse, touch), or focus the grip and use Space +
  // arrow keys.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // The GM's row selection (click, Shift-click, Cmd/Ctrl-click) and row menu
  // (right-click or ⋯), which acts on the selection.
  const [picked, setPicked] = useState<Selection>(NO_SELECTION);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // The monsters folded under the GM row: this viewer's choice, remembered
  // in this browser.
  const [folded, setFolded] = useState(() => readLocal(MONSTERS_FOLDED_KEY) === "1");
  const fold = (f: boolean) => {
    setFolded(f);
    writeLocal(MONSTERS_FOLDED_KEY, f ? "1" : "");
  };

  // A tracked token deleted from the map: the GM's panel saves the tracker
  // without it, and if it was that token's turn, the turn and the marker
  // pass on (deleting the token is the GM's own act, so this is the one
  // marker move made from a data change). One GM is assumed (docs/design.md:
  // no co-GM): the same GM with the panel open twice could end up with two
  // rings until the next turn tidies them.
  const gmReady = role === "GM" && settings.loaded && doc.loaded && items !== null;
  // The last pruned tracker that failed to save: it isn't retried in a loop
  // (the failed write reverts the doc, which would prune it again).
  const lastPrune = useRef("");
  const { value: docValue, write: writeDoc } = doc;
  useEffect(() => {
    if (!gmReady) return;
    const present = new Set(items.map((i) => i.id));
    const pruned = prune(docValue, (id) => present.has(id));
    if (pruned === docValue) return;
    const json = JSON.stringify(pruned);
    if (json === lastPrune.current) return;
    lastPrune.current = json;
    void writeDoc(pruned).then((saved) => {
      if (!saved) return;
      lastPrune.current = "";
      return afterTurnChange(docValue, pruned, settings.value);
    });
  }, [gmReady, items, docValue, writeDoc, settings.value]);

  // The GM's hotkeys while the panel has focus (Owlbear keeps keys typed on
  // the map): N next turn, B back, R the encounter roll when one is due (a
  // stray R can't replace a roll already made). Not while typing, dragging
  // a row or with the row menu open, and not with Cmd / Ctrl / Alt (the
  // browser's own shortcuts).
  const hotkeys = useRef<Record<string, () => void>>({});
  const dragging = useRef(false);
  useEffect(() => {
    if (role !== "GM") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || dragging.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=alertdialog]") || document.querySelector("[role=menu]")) return;
      const run = hotkeys.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role]);

  if (!settings.loaded || !doc.loaded || items === null) return <Loading />;

  const byId = new Map(items.map((i) => [i.id, i]));
  // Tokens deleted from the map drop out. Writes save this pruned version.
  const tracker = prune(doc.value, (id) => byId.has(id));
  const gm = role === "GM";

  // Every GM edit: apply a pure change and save it if anything changed. A
  // new turn also moves the marker and the selection once it's saved (GM
  // clicks only; see marker.ts). A failed save reverts the doc and leaves the
  // marker where it was.
  const change = (fn: (t: TrackerDoc) => TrackerDoc) => {
    const updated = fn(tracker);
    if (updated === doc.value) return;
    void doc.write(updated).then((saved) => {
      if (saved) return afterTurnChange(tracker, updated, settings.value);
    });
  };

  const { entries: shown, current } = gm
    ? tracker
    : playerView(tracker, (id) => tokenInfo(byId.get(id)).visible);
  const top = shown.filter((e) => !e.monster);
  const monsters = shown.filter((e) => e.monster);
  const tokenFor = (e: Entry) => (e.id === GM_ENTRY ? null : tokenInfo(byId.get(e.id)));
  // GM only: select the token on the map (Owlbear's own highlight).
  const show = (id: string) =>
    OBR.player.select([id], true).catch((err) => notify(`Couldn't select the token: ${errorMessage(err)}`, "WARNING"));
  // Token rows in the order shown (monsters right after the GM row).
  const order = top.flatMap((e) => (e.id === GM_ENTRY ? monsters : [e])).map((e) => e.id);
  const selection = keepRows(picked, order);
  const select = (id: string, mods: { shift: boolean; toggle: boolean }) => setPicked(clickRow(selection, id, order, mods));
  const openMenu = (id: string, x: number, y: number) => {
    setPicked(menuTargets(selection, id));
    setMenu({ x, y });
  };
  const rowProps = { gm, change, show, openMenu, select, checking: selection.ids.length > 0, gmMod: tracker.gmMod, gmDie: gmEquation(tracker) };
  const targets = menu ? tracker.entries.filter((e) => selection.ids.includes(e.id)) : [];
  const round = tracker.round;
  const roundLabel =
    round === 0 ? (gm ? "Not started" : "") : gm || !settings.value.hideRound ? `Round ${round}` : "";
  const combat = tracker.phase === "combat";
  // A monster's combat turn opens the folded list, so the current row shows.
  const showMonsters = !folded || (combat && monsters.some((m) => m.id === current));
  // A player's own token (they put it on the map) has the turn.
  const currentToken = current && current !== GM_ENTRY ? byId.get(current) : undefined;
  const myTurn = !gm && currentToken && tokenInfo(currentToken).owner === OBR.player.id ? tokenInfo(currentToken).name : null;
  // Players see the Crawling Clock unless the GM hides it; the GM sees it on the card.
  const showClock = !gm && settings.value.encounterMode === "clock" && !settings.value.hideClock;
  const showDanger = !gm && !combat && settings.value.encounterMode === "standard" && settings.value.showDanger;
  const goNext = () =>
    change((t) => (settings.value.autoRoll ? nextWithAutoRoll(t, settings.value.encounterMode, cryptoRand) : next(t)));
  const mode = settings.value.encounterMode;
  hotkeys.current = {
    n: goNext,
    b: () => change(previous),
    r: () => {
      if (!combat && due(tracker.crawl, mode)) change((t) => updateCrawl(t, (c) => rollFor(mode)(c, cryptoRand)));
    },
  };
  const drop = ({ active, over }: DragEndEvent) => {
    if (over) change((t) => moveTo(t, String(active.id), String(over.id)));
  };

  return (
    // Escape, or a click anywhere in the panel but a token row or the menu,
    // clears the GM's row selection.
    <div
      className="flex min-h-0 flex-1 flex-col gap-2"
      onKeyDown={(e) => e.key === "Escape" && !menu && setPicked(NO_SELECTION)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[aria-selected], [role=menu]")) setPicked(NO_SELECTION);
      }}
    >
      {gm && (
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Phase" className="flex rounded-full bg-obr-bg p-[3px] text-sm font-medium">
            <button
              type="button"
              aria-pressed={!combat}
              className={`h-8 rounded-full px-4 ${combat ? "hover:bg-obr-text/10" : "bg-obr-primary text-obr-primary-contrast"}`}
              onClick={() => change(toCrawl)}
            >
              Crawl
            </button>
            <button
              type="button"
              aria-pressed={combat}
              className={`h-8 rounded-full px-4 ${combat ? "bg-red-700 text-white" : "hover:bg-obr-text/10"}`}
              onClick={() => change((t) => toCombat(t, settings.value.clearRollsOnCombat))}
            >
              Combat
            </button>
          </div>
          <RoundButton label="Sort by roll" onClick={() => change(sortByRoll)}>
            <SortIcon />
          </RoundButton>
          <div className="ml-auto flex gap-1.5">
            <RoundButton label="Previous turn" hint="B" wide disabled={tracker.current === null} onClick={() => change(previous)}>
              <PlayIcon back />
            </RoundButton>
            <RoundButton label="Next turn" hint="N" primary wide onClick={goNext}>
              <PlayIcon />
            </RoundButton>
          </div>
        </div>
      )}

      {/* The phase and round, beside the title. */}
      {titleSlot &&
        createPortal(
          <span
            className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${
              combat ? "bg-red-600/15 text-red-700 dark:text-red-300" : "bg-obr-primary/15 text-obr-text"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${combat ? "bg-red-600 dark:bg-red-400" : "bg-obr-primary"}`} aria-hidden />
            <span>{combat ? "Combat" : "Crawl"}</span>
            {roundLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="text-obr-text">{roundLabel}</span>
              </>
            )}
          </span>,
          titleSlot,
        )}

      {/* Players: the clock or the danger level, if the GM shows them. */}
      {!gm && (showClock || showDanger) && !combat && (
        <section
          aria-label="Crawl status"
          className="flex items-center gap-3 rounded-[14px] bg-obr-bg px-3 py-2 ring-1 ring-obr-text/10 ring-inset"
        >
          {showClock && <ClockDial value={tracker.crawl.clock} size={52} />}
          <span className="flex flex-col text-xs leading-normal text-obr-text-secondary">
            <span>
              <span className="text-sm font-medium text-obr-text">Crawling</span>
              {showDanger && <span className="capitalize"> · {tracker.crawl.danger}</span>}
            </span>
            {showClock && <span>The clock is at {tracker.crawl.clock}</span>}
          </span>
        </section>
      )}
      {myTurn && (
        <p role="status" className="rounded-[10px] bg-obr-primary/15 px-3 py-1.5 text-sm">
          <span className="font-semibold">Your turn</span>, {myTurn}
        </p>
      )}

      {gm &&
        !combat &&
        headerSlot &&
        createPortal(
          <CrawlBar
            crawl={tracker.crawl}
            mode={settings.value.encounterMode}
            gmTurn={tracker.current === GM_ENTRY}
            change={(fn) => change((t) => updateCrawl(t, fn))}
          />,
          headerSlot,
        )}
      {gm &&
        combat &&
        headerSlot &&
        createPortal(
          <p className="rounded-xl bg-red-600/10 px-3 py-2 text-xs text-red-800 ring-1 ring-red-600/30 ring-inset dark:text-red-200">
            <span className="font-semibold text-obr-text">Combat</span> · encounter checks paused
          </p>,
          headerSlot,
        )}

      {/* Only the list scrolls: the controls above stay in view. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pt-px">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={(e) => {
            dragging.current = false;
            drop(e);
          }}
          onDragCancel={() => (dragging.current = false)}
        >
          {/* Two drag groups: players and the GM row; monsters inside the GM row. */}
          <div
            className="flex border-b border-obr-text/10 py-1 pr-1 text-[10px] font-semibold tracking-[0.1em] text-obr-text-disabled uppercase"
            aria-hidden
          >
            <span className={`flex-1 ${gm ? "pl-[82px]" : "pl-[38px]"}`}>Name</span>
            <span className={`${INIT_SLOT} pr-2 text-right`}>Init</span>
            {gm && <span className="w-7" />}
          </div>
          <SortableContext items={top.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col">
              {top.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  token={tokenFor(entry)}
                  current={entry.id === current}
                  selected={selection.ids.includes(entry.id)}
                  {...rowProps}
                >
                  {entry.id === GM_ENTRY && monsters.length > 0 && (
                    <SortableContext items={monsters.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                      <button
                        type="button"
                        aria-expanded={showMonsters}
                        aria-label={showMonsters ? "Fold the monsters" : `Show ${monsters.length} monsters`}
                        className={`flex h-7 w-full items-center gap-1.5 border-b border-obr-text/10 text-[11px] font-medium tracking-[0.04em] text-obr-text-secondary hover:text-obr-text ${
                          gm ? "pl-[48px]" : "pl-2.5"
                        }`}
                        onClick={() => fold(showMonsters)}
                      >
                        <ChevronIcon open={showMonsters} />
                        {showMonsters ? (
                          <span className="uppercase">Monsters · {monsters.length}</span>
                        ) : (
                          <>
                            {monsters.length === 1 ? "1 monster" : `${monsters.length} monsters`}
                            <Stack tokens={monsters.map(tokenFor)} />
                          </>
                        )}
                      </button>
                      {showMonsters && (
                        <ol aria-label="Monsters" className="flex flex-col">
                          {monsters.map((m) => (
                            <Row key={m.id} entry={m} token={tokenFor(m)} current={m.id === current} selected={selection.ids.includes(m.id)} small {...rowProps} />
                          ))}
                        </ol>
                      )}
                    </SortableContext>
                  )}
                </Row>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        {gm && tracker.entries.length === 1 && (
          <p className="text-sm text-obr-text-secondary">
            Right-click a token on the map: “Add / Remove Initiative”. Right-click a row here (or hover it for ⋯) to mark
            monsters; drag its grip to move it. Click a roll to edit it.
          </p>
        )}
      </div>
      {/* Below the list, away from ◀ ▶ (a miss there shouldn't land on these). */}
      {gm && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          {/* A stray click would lose the crawl round count the encounter checks run on. */}
          <Confirm
            label="Reset rounds"
            question="Reset the round count to 0? Encounter checks start over too."
            action="Reset"
            onConfirm={() => change(resetRounds)}
          />
          {/* After a fight: clear the monsters out (kept until then, so a fight can resume). */}
          {!combat && tracker.entries.some((e) => e.monster) && (
            <Confirm
              label="Remove monsters"
              question="Remove every monster from the tracker?"
              action="Remove"
              onConfirm={() => change(removeMonsters)}
            />
          )}
          <span className="ml-auto text-xs text-obr-text-secondary" title="Click in the panel first: Owlbear keeps keys typed on the map.">
            Keys: N next · B back · R roll
          </span>
        </div>
      )}
      {menu && targets.length > 0 && (
        <RowMenu
          entries={targets}
          name={targets.length === 1 ? tokenInfo(byId.get(targets[0].id)).name : `${targets.length} selected`}
          x={menu.x}
          y={menu.y}
          close={() => setMenu(null)}
          change={change}
          show={show}
          clear={() => setPicked(NO_SELECTION)}
        />
      )}
    </div>
  );
};

// The folded monsters' portraits, overlapping (at most five).
const Stack = ({ tokens }: { tokens: (ReturnType<typeof tokenInfo> | null)[] }) => (
  <span className="ml-1 flex" aria-hidden>
    {tokens.slice(0, 5).map((t, i) =>
      t?.image ? (
        <img key={i} src={t.image} alt="" className="-ml-1 h-3.5 w-3.5 rounded-full border-2 border-obr-paper object-cover" />
      ) : (
        <span key={i} className="-ml-1 h-3.5 w-3.5 rounded-full border-2 border-obr-paper bg-obr-text/30" />
      ),
    )}
  </span>
);

// Icon buttons in the turn bar: round (36 px), or a wider pill for ◀ ▶.
// `hint`: its hotkey, shown in the tooltip.
const RoundButton = (
  props: Omit<ButtonProps, "pressed"> & { primary?: boolean; wide?: boolean; disabled?: boolean; hint?: string },
) => (
  <button
    type="button"
    aria-label={props.label}
    aria-keyshortcuts={props.hint}
    title={props.hint ? `${props.label} (${props.hint})` : props.label}
    disabled={props.disabled}
    className={`flex h-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${FOCUS} ${
      props.wide ? (props.primary ? "w-14" : "w-11") : "w-9"
    } ${props.primary ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-bg hover:enabled:bg-obr-text/10"}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default Tracker;
