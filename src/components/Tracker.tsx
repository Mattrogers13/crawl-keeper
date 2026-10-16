import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import Confirm from "./Confirm";
import CrawlBar, { ClockDial } from "./CrawlBar";
import { cryptoRand } from "../crawl";
import Loading from "./Loading";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import type { Role } from "../hooks/useRole";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { afterTurnChange } from "../marker";
import { NO_SELECTION, clickRow, keepRows, menuTargets, type Selection } from "../selection";
import { parseSettings } from "../settings";
import { errorMessage, notify } from "../utils";
import {
  GM_ENTRY,
  NOTE_MAX,
  moveTo,
  next,
  nextWithAutoRoll,
  parseRoll,
  parseTracker,
  playerView,
  previous,
  prune,
  removeMonsters,
  resetRounds,
  remove,
  setDead,
  setMarker,
  setMonster,
  setNote,
  setRoll,
  sortByRoll,
  backToCrawl,
  toCombat,
  updateCrawl,
  type Entry,
  type Tracker as TrackerDoc,
} from "../tracker";

type Token = { name: string; image: string | null; visible: boolean };

// What the tracker shows for a token. Items are Owlbear data: don't trust
// their shape beyond what's checked here.
const tokenInfo = (item: Item | undefined): Token => {
  const image = (item as { image?: { url?: unknown } } | undefined)?.image?.url;
  return {
    name: item?.name?.trim() || "Unnamed",
    image: typeof image === "string" ? image : null,
    visible: item?.visible !== false,
  };
};

// headerSlot: where the crawl controls go (the panel's top bar).
const Tracker = ({ role, headerSlot = null }: { role: Role; headerSlot?: HTMLElement | null }) => {
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
  const rowProps = { gm, change, show, openMenu, select };
  const targets = menu ? tracker.entries.filter((e) => selection.ids.includes(e.id)) : [];
  const round = tracker.round;
  const roundLabel =
    round === 0 ? (gm ? "Press ▶ to begin" : "") : gm || !settings.value.hideRound ? `Round ${round}` : "";
  const combat = tracker.phase === "combat";
  // Players see the Crawling Clock unless the GM hides it; the GM sees it on the card.
  const showClock = !gm && settings.value.encounterMode === "clock" && !settings.value.hideClock;
  const showDanger = !gm && !combat && settings.value.encounterMode === "standard" && settings.value.showDanger;
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
      <div className="flex items-center gap-2">
        {gm ? (
          <div role="group" aria-label="Phase" className="flex rounded-full bg-obr-bg p-[3px] text-sm font-medium">
            <button
              type="button"
              aria-pressed={!combat}
              className={`h-8 rounded-full px-4 ${combat ? "hover:bg-obr-text/10" : "bg-obr-primary text-obr-primary-contrast"}`}
              onClick={() => change((t) => backToCrawl(t, settings.value.encounterMode))}
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
        ) : (
          <h2
            className={`flex h-8 items-center rounded-full px-3.5 font-medium ${combat ? "bg-red-700 text-white" : "bg-obr-bg"}`}
          >
            {combat ? "Combat" : "Crawl"}
          </h2>
        )}
        {gm && (
          <RoundButton label="Sort by roll" onClick={() => change(sortByRoll)}>
            <SortIcon />
          </RoundButton>
        )}
        {roundLabel && <span className="text-sm text-obr-text-secondary">{roundLabel}</span>}
        {showDanger && (
          <span className="ml-auto flex h-8 items-center rounded-full bg-obr-bg px-3 text-xs font-medium capitalize" title="Danger level">
            {tracker.crawl.danger}
          </span>
        )}
        {showClock && (
          <span
            className="ml-auto flex h-8 items-center gap-2 rounded-full bg-obr-bg px-3 text-sm text-obr-text-secondary"
            title="Crawling Clock"
          >
            <ClockDial value={tracker.crawl.clock} size={18} />
            Clock <span className="font-bold text-obr-text tabular-nums">{tracker.crawl.clock}</span>
          </span>
        )}
        {gm && (
          <div className="ml-auto flex gap-1.5">
            <RoundButton label="Previous turn" wide disabled={tracker.current === null} onClick={() => change(previous)}>
              <PlayIcon back />
            </RoundButton>
            <RoundButton
              label="Next turn"
              primary
              wide
              onClick={() =>
                change((t) => (settings.value.autoRoll ? nextWithAutoRoll(t, settings.value.encounterMode, cryptoRand) : next(t)))
              }
            >
              <PlayIcon />
            </RoundButton>
          </div>
        )}
      </div>

      {gm && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {/* After a fight: clear the monsters out (kept until then, so a fight can resume). */}
            {!combat && tracker.entries.some((e) => e.monster) && (
              <Confirm
                label="Remove monsters"
                question="Remove every monster from the tracker?"
                action="Remove"
                onConfirm={() => change(removeMonsters)}
              />
            )}
            {/* A stray click would lose the crawl round count the encounter checks run on. */}
            <Confirm label="Reset rounds" question="Reset the round count to 0?" action="Reset" onConfirm={() => change(resetRounds)} />
          </div>
        </div>
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

      {/* Only the list scrolls: the controls above stay in view. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pt-px">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={drop}
        >
          {/* Two drag groups: players and the GM row; monsters inside the GM row. */}
          <SortableContext items={top.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-0.5">
              {top.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  token={tokenFor(entry)}
                  current={entry.id === current}
                  selected={selection.ids.includes(entry.id)}
                  bracket={entry.id === GM_ENTRY && monsters.length > 0}
                  {...rowProps}
                >
                  {entry.id === GM_ENTRY && monsters.length > 0 && (
                    <SortableContext items={monsters.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                      <span className="block px-2 pt-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase" aria-hidden>
                        Monsters · {monsters.length}
                      </span>
                      <ol aria-label="Monsters" className="flex flex-col gap-0.5">
                        {monsters.map((m) => (
                          <Row key={m.id} entry={m} token={tokenFor(m)} current={m.id === current} selected={selection.ids.includes(m.id)} {...rowProps} />
                        ))}
                      </ol>
                    </SortableContext>
                  )}
                </Row>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        {gm && tracker.entries.length === 1 && (
          <p className="text-sm text-obr-text-secondary">
            Right-click a token on the map: “Add / Remove Initiative”. Right-click a row here to mark monsters.
          </p>
        )}
      </div>
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

// The GM's actions for the selected token rows (one or many). Opened by
// right-clicking a row or its ⋯ button (touch has no right-click). Closes on
// a choice, Escape, or a click elsewhere. A mixed selection offers both ways.
const RowMenu = (props: {
  entries: Entry[];
  name: string;
  x: number;
  y: number;
  close: () => void;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
  show: (id: string) => void;
  clear: () => void;
}) => {
  const { entries, close, change } = props;
  const ids = entries.map((e) => e.id);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: props.x, top: props.y });

  // Keep it inside the panel; focus the first item.
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(props.x, window.innerWidth - box.width - 4)),
      top: Math.max(4, Math.min(props.y, window.innerHeight - box.height - 4)),
    });
    ref.current!.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [props.x, props.y]);

  useEffect(() => {
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [close]);

  // [label, shown?, action]
  const some = (f: (e: Entry) => boolean) => entries.some(f);
  const items: [string, boolean, () => void][] = [
    ["Mark as monster", some((e) => !e.monster), () => change((t) => setMonster(t, ids, true))],
    ["Mark as player or ally", some((e) => e.monster), () => change((t) => setMonster(t, ids, false))],
    ["Mark dead", some((e) => !e.dead), () => change((t) => setDead(t, ids, true))],
    ["Mark alive", some((e) => e.dead), () => change((t) => setDead(t, ids, false))],
    ["Turn marker on", some((e) => !e.marker), () => change((t) => setMarker(t, ids, true))],
    ["Turn marker off", some((e) => e.marker), () => change((t) => setMarker(t, ids, false))],
    ["Show on map", ids.length === 1, () => props.show(ids[0])],
    [
      ids.length === 1 ? "Remove from initiative" : `Remove ${ids.length} from initiative`,
      true,
      () => {
        change((t) => remove(t, ids));
        props.clear();
      },
    ],
  ];
  // Up / Down move between items.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") return close();
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...ref.current!.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={props.name}
      style={pos}
      className="fixed z-50 flex min-w-44 flex-col rounded border border-obr-text-disabled bg-obr-paper py-1 text-sm shadow-lg"
      onKeyDown={onKeyDown}
    >
      {items
        .filter(([, shown]) => shown)
        .map(([label, , run]) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          className="px-3 py-1 text-left hover:bg-obr-bg focus:bg-obr-bg focus:outline-none"
          onClick={() => {
            run();
            close();
          }}
        >
          {label}
        </button>
        ))}
    </div>
  );
};

const Row = (props: {
  entry: Entry;
  token: Token | null;
  current: boolean;
  gm: boolean;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
  show: (id: string) => void;
  openMenu: (id: string, x: number, y: number) => void;
  select: (id: string, mods: { shift: boolean; toggle: boolean }) => void;
  selected: boolean;
  // The GM row's crawl card and monsters, listed under it.
  children?: ReactNode;
  // The GM row with monsters: one card holds the group.
  bracket?: boolean;
}) => {
  const { entry, token, gm, change } = props;
  const name = token ? token.name : "GM / Monsters";
  // Players can't drag: no grip, and the sortable is off.
  const sortable = useSortable({ id: entry.id, disabled: !gm });
  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-current={props.current ? "step" : undefined}
      // The GM row and its monsters share one card instead of an indent (an
      // indent squeezes the monsters' notes).
      className={`${sortable.isDragging ? "relative z-10 rounded-lg bg-obr-paper shadow-lg" : ""} ${
        props.bracket ? "flex flex-col gap-0.5 rounded-[10px] bg-obr-bg p-1" : ""
      }`}
    >
      <div
        className={`group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${
          props.current ? "bg-obr-primary/20 shadow-[inset_3px_0_0_var(--obr-primary)]" : gm ? "hover:bg-obr-text/5" : ""
        } ${token && !token.visible ? "opacity-60" : ""} ${
          entry.dead ? "opacity-55" : ""
        } ${props.selected ? "outline-2 -outline-offset-2 outline-obr-secondary outline-dashed" : ""}`}
        aria-selected={gm && token ? props.selected : undefined}
        // GM: click to select (Shift: a range, Cmd/Ctrl: one more), except on
        // the row's own boxes and buttons.
        onClick={
          gm && token
            ? (e) => {
                if ((e.target as HTMLElement).closest("input, button")) return;
                props.select(entry.id, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
              }
            : undefined
        }
        // GM: right-click a token's row for its menu.
        onContextMenu={
          gm && token
            ? (e) => {
                e.preventDefault();
                props.openMenu(entry.id, e.clientX, e.clientY);
              }
            : undefined
        }
      >
        {gm && (
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`Move ${name}`}
            title="Drag to move"
            className={`flex h-9 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-obr-text-secondary hover:text-obr-text active:cursor-grabbing ${HOVER_ONLY}`}
          >
            <GripIcon />
          </button>
        )}
        {gm && token ? (
          <button type="button" aria-label={`Show ${name} on the map`} title="Show on the map" onClick={() => props.show(entry.id)}>
            <Portrait token={token} dead={entry.dead} marker={entry.marker} />
          </button>
        ) : (
          <Portrait token={token} dead={entry.dead} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-medium ${entry.dead ? "line-through" : ""}`}>
            {name}
            {entry.dead && <span className="sr-only"> (dead)</span>}
          </span>
          {gm ? (
            <NoteInput key={entry.note} name={name} value={entry.note} save={(n) => change((t) => setNote(t, entry.id, n))} />
          ) : (
            entry.note && <span className="text-xs whitespace-pre-wrap text-obr-text-secondary">{entry.note}</span>
          )}
        </div>
        {gm ? (
          <>
            {/* Monsters act on the GM / Monsters roll: a gap keeps the columns lined up. */}
            {entry.monster ? (
              <span className={ROLL_SLOT} aria-hidden />
            ) : (
              <RollInput key={entry.roll ?? ""} name={name} value={entry.roll} save={(r) => change((t) => setRoll(t, entry.id, r))} />
            )}
            {/* The row menu (also on right-click). The GM row has none: a gap keeps the roll boxes lined up. */}
            {token ? (
              <RowAction
                label={`Actions for ${name}`}
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  props.openMenu(entry.id, box.left, box.bottom);
                }}
              >
                <MoreIcon />
              </RowAction>
            ) : (
              <span className={ROW_ACTION} aria-hidden />
            )}
          </>
        ) : (
          <span className="w-10 text-right text-lg font-bold tabular-nums">{entry.monster ? "" : (entry.roll ?? "–")}</span>
        )}
      </div>
      {props.children}
    </li>
  );
};

// `marker`: a gold dot (GM view) when this token gets the turn marker.
const Portrait = ({ token, dead, marker = false }: { token: Token | null; dead: boolean; marker?: boolean }) => (
  <div className="relative h-9 w-9 shrink-0">
    {token?.image ? (
      <img src={token.image} alt="" className={`h-9 w-9 rounded-full object-cover ${dead ? "grayscale" : ""}`} />
    ) : (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-obr-text/10 text-xs font-bold" aria-hidden>
        {token ? "?" : "GM"}
      </div>
    )}
    {dead && (
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white" aria-hidden>
        <SkullIcon className="h-6 w-6" />
      </span>
    )}
    {marker && (
      <span
        className="absolute -right-px -bottom-px h-[11px] w-[11px] rounded-full border-2 border-obr-paper bg-[#f5c542]"
        title="Gets the turn marker"
        aria-label="Turn marker on"
        role="img"
      />
    )}
  </div>
);

const ROLL_SLOT = "w-12 shrink-0";

// A text box that saves on Enter or when focus leaves. `read` turns the text
// into a value, or undefined when it can't (the box then puts the old text
// back). Unchanged text saves nothing.
const useDraft = <T,>(shown: string, read: (text: string) => T | undefined, save: (value: T) => void) => {
  const [draft, setDraft] = useState(shown);
  return {
    value: draft,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: () => {
      if (draft === shown) return;
      const value = read(draft);
      if (value === undefined) setDraft(shown);
      else save(value);
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur(),
  };
};

// Borderless until hovered or focused.
const GHOST_INPUT =
  "rounded border border-transparent bg-transparent hover:border-obr-text-disabled focus:border-obr-primary focus:outline-none";

// Empty = no roll.
const readRoll = (text: string) => (text.trim() === "" ? null : (parseRoll(Number(text)) ?? undefined));

const RollInput = ({ name, value, save }: { name: string; value: number | null; save: (r: number | null) => void }) => (
  <input
    aria-label={`Initiative for ${name}`}
    inputMode="numeric"
    placeholder="–"
    className={`${ROLL_SLOT} px-1 py-0.5 text-right text-lg font-bold tabular-nums placeholder:font-normal placeholder:text-obr-text-disabled ${GHOST_INPUT}`}
    {...useDraft(value === null ? "" : String(value), readRoll, save)}
  />
);

const NoteInput = ({ name, value, save }: { name: string; value: string; save: (n: string) => void }) => (
  <input
    aria-label={`Note for ${name}`}
    placeholder="Add a note"
    maxLength={NOTE_MAX}
    className={`-ml-1 w-full min-w-0 px-1 text-xs text-obr-text-secondary ${GHOST_INPUT}`}
    {...useDraft(value, (text) => text, save)}
  />
);

type ButtonProps = { label: string; pressed?: boolean; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode };

// Icon buttons in the turn bar: round (36 px), or a wider pill for ◀ ▶.
const RoundButton = (props: Omit<ButtonProps, "pressed"> & { primary?: boolean; wide?: boolean; disabled?: boolean }) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    disabled={props.disabled}
    className={`flex h-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
      props.wide ? (props.primary ? "w-14" : "w-11") : "w-9"
    } ${props.primary ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-bg hover:enabled:bg-obr-text/10"}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

// The grip and ⋯ show on hovering the row, or focusing them; on touch screens
// (no hover) they always show.
const HOVER_ONLY = "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

// Dead and remove: full-size touch targets, the same width on every row (see Row).
const ROW_ACTION = "h-7 w-7 shrink-0";

const RowAction = (props: ButtonProps) => (
  <button
    type="button"
    aria-label={props.label}
    aria-pressed={props.pressed}
    title={props.label}
    className={`${ROW_ACTION} flex items-center justify-center rounded-full hover:bg-obr-paper hover:text-obr-text ${HOVER_ONLY} ${
      props.pressed ? "bg-obr-primary text-obr-primary-contrast hover:bg-obr-primary hover:text-obr-primary-contrast" : "text-obr-text-secondary"
    }`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

// Drawn for this extension (no icon font: no third-party requests).
const SkullIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 0-8 8c0 2.7 1.3 4.7 3 5.8V19a1 1 0 0 0 1 1h1v-2h2v2h2v-2h2v2h1a1 1 0 0 0 1-1v-3.2c1.7-1.1 3-3.1 3-5.8a8 8 0 0 0-8-8zM8.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13.5l-1.2 2h2.4z"
    />
  </svg>
);

// Three dots: more actions.
const MoreIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </svg>
);

// Three lines: the usual drag handle.
const GripIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M3 4h10M3 8h10M3 12h10" />
  </svg>
);

// A play triangle: ▶ next, ◀ back.
const PlayIcon = ({ back = false }: { back?: boolean }) => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
    <path d={back ? "M11 2L4 8l7 6z" : "M5 2l7 6-7 6z"} />
  </svg>
);

// Bars shortening downward: the usual "sort, highest first" icon.
const SortIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 4h12M2 8h8M2 12h4" />
  </svg>
);

export default Tracker;
