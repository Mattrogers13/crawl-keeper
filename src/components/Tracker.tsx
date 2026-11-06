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
import { onAddEffect, takeHandoff } from "../addEffectHandoff";
import { AddEffect, RowEffects, type EffectsChange } from "./Effects";
import DyingSheet from "./DyingSheet";
import Notices from "./Notices";
import TimeSheet from "./TimeSheet";
import CrawlBar, { ClockDial, FOCUS, PlayerRoll } from "./CrawlBar";
import { clockLeft, clockStart, crawlDie, cryptoRand, due, lastFor, replayRand, rollFor } from "../crawl";
import { dicePlusActive, rollDice, rollExploding, setDicePlusEnabled, type RollTarget } from "../diceRoller";
import { ChevronIcon, HourglassIcon, PlayIcon, SortIcon } from "./icons";
import Loading from "./Loading";
import RowMenu from "./RowMenu";
import Row, { INIT_SLOT, tokenInfo, type ButtonProps, type Token } from "./TrackerRow";
import { EFFECTS_KEY, MONSTERS_FOLDED_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import {
  endFocusOf,
  endingNow,
  focusChecks,
  parseEffects,
  playerEffects,
  pruneEffects,
  resetEffectRounds,
  settle,
  shown as shownEffects,
  stopDying,
  hideDeath,
  timerOutOnTurn,
  type Effect,
  type Effects,
} from "../effects";
import { sayDeath } from "../deathNotices";
import type { Change as HistoryChange } from "../history";
import type { Role } from "../hooks/useRole";
import { useLightStatus, useLights } from "../hooks/useLights";
import { followingLights, type Light } from "../lights";
import { centerOn } from "../viewport";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { afterChange } from "../marker";
import { record } from "../undo";
import { NO_SELECTION, clickRow, keepRows, menuTargets, type Selection } from "../selection";
import { effectiveMode, parseSettings } from "../settings";
import { readLocal, writeLocal } from "../storage";
import { errorMessage, notify } from "../utils";
import {
  GM_ENTRY,
  gmEquation,
  moveTo,
  next,
  nextAfterManualCheck,
  nextWithAutoRoll,
  parseTracker,
  playerView,
  previous,
  prune,
  removeMonsters,
  resetRounds,
  setDead,
  sortByRoll,
  toCombat,
  toCrawl,
  updateCrawl,
  type Entry,
  type Tracker as TrackerDoc,
} from "../tracker";

// A GM edit to the tracker: a pure change, saved, and an undo step named
// `label` ("Undo: Next turn"); `toast` offers Undo for a few seconds after
// bigger actions.
// `effects`: a change to this map's effects in the same write and undo step
// (Mark dead ends focus, Reset rounds keeps rounds left).
export type ChangeOpts = { toast?: boolean; effects?: (e: Effects, before: TrackerDoc, after: TrackerDoc) => Effects };
export type Change<T = TrackerDoc> = (label: string, fn: (t: T) => T, opts?: ChangeOpts) => void;

// No lights (players: the notices tell the GM's lights only).
const NO_LIGHTS: Light[] = [];

// toolSlot: the buttons beside the title (the GM's ⏳ Time passes); titleSlot:
// beside the title, for the round count.
const Tracker = (props: { role: Role; toolSlot?: HTMLElement | null; titleSlot?: HTMLElement | null }) => {
  const { role, toolSlot = null, titleSlot = null } = props;
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  const doc = useSceneValue(TRACKER_KEY, parseTracker);
  const effectsDoc = useSceneValue(EFFECTS_KEY, parseEffects);
  // The GM gives lights from the row menu; everyone sees them on the rows.
  const lights = useLights();
  const lightStatus = useLightStatus(lights.lights);
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
  // The token row whose empty note the GM opened from its menu.
  const [noting, setNoting] = useState<string | null>(null);
  // The GM's Add effect form, for these rows (none: free-standing).
  const [adding, setAdding] = useState<string[] | null>(null);
  // The Time passes sheet (the ⏳ beside the title).
  const [timing, setTiming] = useState(false);
  // A Dice+ roll on its way (src/diceRoller.ts): the ref guards, the state shows.
  const rollingRef = useRef(false);
  // The newest change functions, for what lands later (liveChange below).
  const latest = useRef<{ change: Change; changeEffects: EffectsChange } | null>(null);
  const [rolling, setRolling] = useState(false);
  // The Dying sheet, for this row (row menu → Dying…).
  const [dyingFor, setDyingFor] = useState<string | null>(null);
  // One sheet at a time: the newest takes over.
  const openAdding = (ids: string[] | null) => {
    if (ids) {
      setTiming(false);
      setDyingFor(null);
    }
    setAdding(ids);
  };
  const openDying = (id: string) => {
    setAdding(null);
    setTiming(false);
    setDyingFor(id);
  };
  // Focus checks the GM called for now (damage, distraction): this panel only.
  const [checkNow, setCheckNow] = useState<string[]>([]);
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
      return afterChange(docValue, pruned, settings.value);
    });
  }, [gmReady, items, docValue, writeDoc, settings.value]);

  // The same for effects: a deleted token's effects go, and what ends with
  // its focus (automatic, not an undo step).
  const lastEffectsPrune = useRef("");
  const { value: effectsValue, write: writeEffects } = effectsDoc;
  const effectsReady = gmReady && effectsDoc.loaded;
  useEffect(() => {
    if (!effectsReady) return;
    const present = new Set(items.map((i) => i.id));
    const pruned = pruneEffects(effectsValue, (id) => present.has(id));
    if (pruned === effectsValue) return;
    const json = JSON.stringify(pruned);
    if (json === lastEffectsPrune.current) return;
    lastEffectsPrune.current = json;
    void writeEffects(pruned).then((saved) => {
      if (saved) lastEffectsPrune.current = "";
    });
  }, [effectsReady, items, effectsValue, writeEffects]);

  // The map's right-click Add effect… (addEffectHandoff.ts): the tokens
  // waiting when the tracker mounts (the panel was closed), or sent now (it
  // was open). The stored handoff wins so it's taken once; the message's ids
  // if storage is blocked.
  // The GM's rolls: Dice+ or here, as the room setting says (checked in the
  // background, so rolls never wait for it).
  const dicePlusSetting = settings.loaded && settings.value.dicePlus;
  useEffect(() => {
    if (role === "GM") setDicePlusEnabled(dicePlusSetting);
  }, [role, dicePlusSetting]);
  useEffect(() => {
    if (role !== "GM") return;
    const waiting = takeHandoff();
    if (waiting) openAdding(waiting);
    return onAddEffect((ids) => openAdding(takeHandoff() ?? ids));
  }, [role]);

  // A called-for focus check lasts until the turn moves.
  useEffect(() => setCheckNow([]), [docValue.current, docValue.round]);

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

  if (!settings.loaded || !doc.loaded || !effectsDoc.loaded || items === null) return <Loading />;

  const byId = new Map(items.map((i) => [i.id, i]));
  // Tokens deleted from the map drop out. Writes save this pruned version.
  const tracker = prune(doc.value, (id) => byId.has(id));
  const effects = pruneEffects(effectsDoc.value, (id) => byId.has(id));
  const gm = role === "GM";

  // Every GM edit: apply a pure change and save it if anything changed. A
  // new turn also moves the marker and the selection once it's saved (GM
  // clicks only; see marker.ts). A failed save reverts the doc and leaves the
  // marker where it was. Saved, it's an undo step named `label`.
  // With `effects`, both are saved in one write (both or neither), one step.
  const change: Change = (label, fn, opts) => {
    const before = doc.value;
    const updated = fn(tracker);
    const effectsBefore = effectsDoc.value;
    const changedEffects = opts?.effects?.(effects, tracker, updated) ?? effects;
    const effectsAfter = changedEffects === effects ? effectsBefore : settle(changedEffects, updated);
    if (updated === before && effectsAfter === effectsBefore) return;
    const steps: HistoryChange[] = [];
    if (updated !== before) steps.push({ store: "scene", key: TRACKER_KEY, before, after: updated });
    if (effectsAfter !== effectsBefore) steps.push({ store: "scene", key: EFFECTS_KEY, before: effectsBefore, after: effectsAfter });
    const write =
      updated === before
        ? effectsDoc.write(effectsAfter)
        : doc.write(updated, effectsAfter !== effectsBefore ? { [EFFECTS_KEY]: effectsAfter } : undefined);
    void write.then((saved) => {
      if (!saved) return;
      void record(label, steps, opts);
      if (updated !== before) return afterChange(tracker, updated, settings.value);
    });
  };
  // An effects change on its own. `fn` runs now: what the rules refuse
  // throws to the caller (the Add effect form asks before ending a focus).
  const changeEffects: EffectsChange = (label, fn) => {
    const changed = fn(effects, tracker);
    if (changed === effects) return;
    change(label, (t) => t, { effects: () => changed });
  };
  // The same, but always with the newest state: for what lands later (a
  // Dice+ roll after ▶ moved the turn must not write over it).
  latest.current = { change, changeEffects };
  const liveChange: Change = (label, fn, opts) => latest.current!.change(label, fn, opts);
  const liveChangeEffects: EffectsChange = (label, fn) => latest.current!.changeEffects(label, fn);

  const { entries: shown, current } = gm
    ? tracker
    : playerView(tracker, (id) => tokenInfo(byId.get(id)).visible);
  const top = shown.filter((e) => !e.monster);
  const monsters = shown.filter((e) => e.monster);
  const tokenFor = (e: Entry) => (e.id === GM_ENTRY ? null : tokenInfo(byId.get(e.id)));
  // GM only: select the token on the map (Owlbear's own highlight).
  const show = (id: string) =>
    OBR.player.select([id], true).catch((err) => notify(`Couldn't select the token: ${errorMessage(err)}`, "WARNING"));
  // GM only: center the camera on the token, and select it there too.
  const focus = (id: string) => {
    void show(id);
    centerOn(id).catch((err) => notify(`Couldn't move to the token: ${errorMessage(err)}`, "WARNING"));
  };
  // Token rows in the order shown (monsters right after the GM row).
  const order = top.flatMap((e) => (e.id === GM_ENTRY ? monsters : [e])).map((e) => e.id);
  const selection = keepRows(picked, order);
  const select = (id: string, mods: { shift: boolean; toggle: boolean }) => setPicked(clickRow(selection, id, order, mods));
  const openMenu = (id: string, x: number, y: number) => {
    setPicked(menuTargets(selection, id));
    setMenu({ x, y });
  };
  // Each token's lights, for its row's badges.
  const lightsOf = new Map<string, Light[]>();
  for (const l of lights.lights.lights) lightsOf.set(l.tokenId, [...(lightsOf.get(l.tokenId) ?? []), l]);
  // Total darkness (p. 84; isDark in lights.ts): the lights when Follow
  // light is on and lights are tracked, else this map's switch. Disadvantage
  // on living players' rows, a check every crawl round, a d8 crawling die.
  const following = followingLights(settings.value.followLight, lights.lights);
  const dark = following ? lightStatus === "dark" : tracker.crawl.dark;
  // Players see the lights unless the GM turns that off (their own stay in
  // their Light Tracker view, PlayerLights.tsx).
  const seeLights = gm || settings.value.showLights;
  const lightProps = (e: Entry) =>
    seeLights ? { lights: lightsOf.get(e.id), dis: dark && e.id !== GM_ENTRY && !e.monster && !e.dead } : { lights: undefined, dis: false };
  // Effects (docs/effects.md): players see none hidden, nor any on tokens
  // hidden from them. On a row when the holder is listed; else the strip.
  const names = new Map(items.map((i) => [i.id, tokenInfo(i).name]));
  // The death timer reads as hidden when the GM keeps it to themselves.
  const shownDeath = hideDeath(effects, settings.value.showDeath);
  const seenEffects = gm ? shownDeath : playerEffects(shownDeath, (id) => tokenInfo(byId.get(id)).visible);
  const listedEffects = shownEffects(seenEffects, tracker);
  const rowIds = new Set(shown.map((e) => e.id));
  const effectsOf = new Map<string, Effect[]>();
  for (const e of listedEffects) if (e.holder !== null && rowIds.has(e.holder)) effectsOf.set(e.holder, [...(effectsOf.get(e.holder) ?? []), e]);
  const looseEffects = listedEffects.filter((e) => e.holder === null || !rowIds.has(e.holder));
  const effectChange = gm ? liveChangeEffects : null;
  const dueChecks = focusChecks(seenEffects, tracker);
  const calledChecks = seenEffects.effects.filter((e) => checkNow.includes(e.id) && !dueChecks.includes(e));
  const rowEffects = (e: Entry) => {
    const list = effectsOf.get(e.id);
    return list ? <RowEffects effects={list} tracker={tracker} change={effectChange} current={e.id === current} name={names.get(e.id)} /> : undefined;
  };
  const rowProps = { gm, change: liveChange, show, focus, openMenu, lightChange: gm ? lights.change : null, select, checking: selection.ids.length > 0, gmMod: tracker.gmMod, gmDie: gmEquation(tracker), noting, setNoting };
  const targets = menu ? tracker.entries.filter((e) => selection.ids.includes(e.id)) : [];
  const round = tracker.round;
  const roundLabel =
    round === 0 ? (gm ? "Not started" : "") : gm || !settings.value.hideRound ? `Round ${round}` : "";
  const combat = tracker.phase === "combat";
  // A monster's combat turn opens the folded list while it lasts, so the
  // current row shows (folding is off until then).
  const monsterTurn = combat && monsters.some((m) => m.id === current);
  const showMonsters = !folded || monsterTurn;
  // A player's own token (they put it on the map) has the turn.
  const currentToken = !gm && current && current !== GM_ENTRY ? tokenInfo(byId.get(current)) : null;
  const myTurn = currentToken && currentToken.owner === OBR.player.id ? currentToken.name : null;
  const mode = effectiveMode(settings.value);
  const start = clockStart(settings.value.clockDice);
  // Players see the Crawling Clock unless the GM hides it; the GM sees it on the card.
  const showClock = !gm && mode === "clock" && !settings.value.hideClock;
  const showDanger = !gm && !combat && mode !== "clock" && settings.value.showDanger;
  // Manual: the GM's rolls stay the GM's.
  const playerRoll = !gm && mode !== "manual" && settings.value.showRolls ? lastFor(tracker.crawl, mode) : null;
  // The encounter roll (the card's die, R, the auto roll): here, or Dice+
  // when it answered (src/diceRoller.ts), shown to players as the setting
  // says. One at a time: a second click while Dice+ rolls does nothing.
  const rollTarget: RollTarget = mode !== "manual" && settings.value.showRolls ? "everyone" : "gm_only";
  const rollEncounter = (label: string) => {
    if (!dicePlusActive()) return change(label, (t) => updateCrawl(t, (c) => rollFor(mode, start, dark)(c, cryptoRand)));
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    const sides = mode === "clock" ? crawlDie(dark) : 6;
    const dice = mode === "clock" ? rollExploding(sides, label, rollTarget) : rollDice({ count: 1, sides, label, target: rollTarget });
    void dice
      .then((values) => liveChange(label, (t) => updateCrawl(t, (c) => rollFor(mode, start, dark)(c, replayRand(values, sides)))))
      .finally(() => {
        rollingRef.current = false;
        setRolling(false);
      });
  };
  // With Dice+ the auto roll takes a moment: the turn moves now, the roll
  // lands as its own step. Without it, one step as before.
  const deferRoll = mode !== "manual" && settings.value.autoRoll && dicePlusActive();
  const advance = (t: TrackerDoc) =>
    mode === "manual"
      ? nextAfterManualCheck(t, dark)
      : settings.value.autoRoll && !deferRoll
        ? nextWithAutoRoll(t, mode, cryptoRand, start, dark)
        : next(t);
  // A death timer that runs out at the start of this turn marks them dead
  // in the same step (skull on the row and the token; Undo brings them back).
  const goNext = () => {
    const moved = next(tracker);
    const holder = timerOutOnTurn(effects, moved);
    if (holder) {
      change("Next turn", (t) => setDead(advance(t), [holder], true), { effects: (s) => stopDying(endFocusOf(s, [holder]), holder) });
      void sayDeath({ event: "died", name: names.get(holder) ?? "A character" });
    } else change("Next turn", advance);
    if (deferRoll && moved.phase === "crawl" && moved.current === GM_ENTRY && due(moved.crawl, mode, dark)) rollEncounter(mode === "clock" ? "Crawling die" : "Encounter check");
  };
  hotkeys.current = {
    n: goNext,
    b: () => change("Back", previous),
    r: () => {
      if (!combat && due(tracker.crawl, mode, dark)) rollEncounter("Encounter roll");
    },
  };
  const drop = ({ active, over }: DragEndEvent) => {
    if (over) change("Move row", (t) => moveTo(t, String(active.id), String(over.id)));
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
              onClick={() => change("Crawl", toCrawl)}
            >
              Crawl
            </button>
            <button
              type="button"
              aria-pressed={combat}
              className={`h-8 rounded-full px-4 ${combat ? "bg-red-700 text-white" : "hover:bg-obr-text/10"}`}
              onClick={() => change("Combat", (t) => toCombat(t, settings.value.clearRollsOnCombat))}
            >
              Combat
            </button>
          </div>
          <RoundButton label="Sort by roll" onClick={() => change("Sort by roll", sortByRoll)}>
            <SortIcon />
          </RoundButton>
          <div className="ml-auto flex gap-1.5">
            <RoundButton label="Previous turn" hint="B" wide disabled={tracker.current === null} onClick={() => change("Back", previous)}>
              <PlayIcon back />
            </RoundButton>
            <RoundButton label="Next turn" hint="N" primary wide onClick={goNext}>
              <PlayIcon />
            </RoundButton>
          </div>
        </div>
      )}
      {/* Under the turn bar, where they're easy to find (each asks first). */}
      {gm && (
        <div className="-mt-1 flex shrink-0 flex-wrap items-center gap-x-3">
          {/* A stray click would lose the crawl round count the encounter checks run on. */}
          <Confirm
            label="Reset rounds"
            question="Reset the round count to 0? Encounter checks start over too."
            action="Reset"
            onConfirm={() => change("Reset rounds", resetRounds, { toast: true, effects: resetEffectRounds })}
          />
          {/* A free-standing effect (a row's own: its menu). */}
          <button type="button" className="py-1.5 text-xs text-obr-text-secondary underline hover:text-obr-text" onClick={() => openAdding([])}>
            Add effect
          </button>
          {/* After a fight: clear the monsters out (kept until then, so a fight can resume). */}
          {!combat && tracker.entries.some((e) => e.monster) && (
            <Confirm
              label="Remove monsters"
              question="Remove every monster from the tracker?"
              action="Remove"
              onConfirm={() => change("Remove monsters", removeMonsters, { toast: true })}
            />
          )}
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

      {/* Players: the clock, the danger level and the last roll, as the GM allows. */}
      {!gm && (showClock || showDanger || playerRoll) && !combat && (
        <section
          aria-label="Crawl status"
          className="flex items-center gap-3 rounded-[14px] bg-obr-bg px-3 py-2 ring-1 ring-obr-text/10 ring-inset"
        >
          {showClock && <ClockDial value={clockLeft(tracker.crawl, start)} of={start} size={52} />}
          <span className="flex flex-col text-xs leading-normal text-obr-text-secondary">
            <span>
              <span className="text-sm font-medium text-obr-text">{showClock ? "Crawling Clock" : "Crawling"}</span>
              {showDanger && <span className="capitalize"> · {tracker.crawl.danger}</span>}
            </span>
            {showClock && <span>The clock is at {clockLeft(tracker.crawl, start)}</span>}
          </span>
          {playerRoll && (
            <span className="ml-auto" aria-label="Last roll">
              <PlayerRoll roll={playerRoll} />
            </span>
          )}
        </section>
      )}
      {myTurn && (
        <p role="status" className="rounded-[10px] bg-obr-primary/15 px-3 py-1.5 text-sm">
          <span className="font-semibold">Your turn</span>, {myTurn}
        </p>
      )}

      {/* Under the turn bar (layout B, 2026-11-06), so ◀ ▶ never moves:
          the crawl card (combat: a line), then the notices. */}
      {gm && !combat && (
        <CrawlBar
          crawl={tracker.crawl}
          mode={mode}
          start={start}
          gmTurn={tracker.current === GM_ENTRY}
          dark={dark}
          following={following}
          change={(label, fn, opts) => change(label, (t) => updateCrawl(t, fn), opts)}
          roll={rollEncounter}
          rolling={rolling}
          seen={{
            clock: mode === "clock" && !settings.value.hideClock,
            danger: mode !== "clock" && settings.value.showDanger,
            rolls: mode !== "manual" && settings.value.showRolls,
          }}
        />
      )}
      {gm && combat && (
        <p className="shrink-0 rounded-xl bg-red-600/10 px-3 py-1.5 text-xs text-red-800 ring-1 ring-red-600/30 ring-inset dark:text-red-200">
          <span className="font-semibold text-obr-text">Combat</span> · encounter checks paused
        </p>
      )}
      <Notices
        dark={gm && dark}
        checks={[...dueChecks, ...calledChecks]}
        extra={calledChecks.map((e) => e.id)}
        dismiss={(id) => setCheckNow((c) => c.filter((x) => x !== id))}
        ending={endingNow(seenEffects, tracker).filter((e) => e.icon !== "dying")}
        lights={gm && lights.loaded ? lights.lights.lights : NO_LIGHTS}
        loose={looseEffects}
        tracker={tracker}
        names={names}
        change={effectChange}
        dying={seenEffects.effects.filter((e) => e.icon === "dying")}
        rollD20={() => rollDice({ count: 1, sides: 20, label: "Death d20", target: "everyone" }).then((d) => d[0])}
        markDead={
          gm
            ? (id) => {
                change("Mark dead", (t) => setDead(t, [id], true), { effects: (s) => stopDying(endFocusOf(s, [id]), id) });
                void sayDeath({ event: "died", name: names.get(id) ?? "A character" });
              }
            : null
        }
      />
      {/* The GM's ⏳ beside the title: the Time passes sheet. */}
      {gm &&
        toolSlot &&
        createPortal(
          <button
            type="button"
            aria-label="Time passes"
            aria-expanded={timing}
            title="Time passes: lights burn, rounds effects end"
            className={`flex h-8 w-8 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text ${timing ? "bg-obr-primary/20 text-obr-text" : ""}`}
            onClick={() => {
              setAdding(null);
              setDyingFor(null);
              setTiming(!timing);
            }}
          >
            <HourglassIcon />
          </button>,
          toolSlot,
        )}

      {/* Only the list scrolls: the controls above stay in view. */}
      <div className="relative -mx-1 flex min-h-0 flex-1 flex-col">
      {/* The Add effects and Time passes sheets cover the list while open (the panel is short). */}
      {gm && (adding || timing || dyingFor) && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-obr-paper px-1">
          {adding ? (
            <AddEffect key={adding.join()} holders={adding} names={names} tracker={tracker} effects={effects} change={changeEffects} close={() => setAdding(null)} />
          ) : dyingFor ? (
            <DyingSheet
              key={dyingFor}
              holder={dyingFor}
              name={names.get(dyingFor) ?? "A character"}
              change={liveChangeEffects}
              close={() => setDyingFor(null)}
              rollD4={() => rollDice({ count: 1, sides: 4, label: "Death timer", target: "everyone" }).then((d) => d[0])}
            />
          ) : (
            <TimeSheet lights={lights.lights} effects={effects} change={lights.change} names={names} close={() => setTiming(false)} />
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-px" inert={gm && (adding || timing || dyingFor) ? true : undefined}>
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
            {/* Lined up with the names: the GM's grip, checkbox and portrait (16 + 16 + 26 px and
                three 8 px gaps), or a player's inset and portrait (4 + 26 + 8). */}
            <span className={`flex-1 ${gm ? "pl-[82px]" : "pl-[38px]"}`}>Name</span>
            <span className={`${INIT_SLOT} pr-2 text-right`}>Init</span>
            {gm && <span className="w-7" />}
          </div>
          <SortableContext items={top.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col">
              {top.map((entry) => (
                <Row
                  key={entry.id}
                  effects={rowEffects(entry)}
                  {...lightProps(entry)}
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
                        disabled={monsterTurn}
                        title={monsterTurn ? "Shown while a monster has the turn" : undefined}
                        className={`flex h-7 w-full items-center gap-1.5 border-b border-obr-text/10 text-[11px] font-medium tracking-[0.04em] text-obr-text-secondary enabled:hover:text-obr-text ${
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
                            <Row key={m.id} effects={rowEffects(m)} {...lightProps(m)} entry={m} token={tokenFor(m)} current={m.id === current} selected={selection.ids.includes(m.id)} small {...rowProps} />
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
      </div>
      {gm && (
        <div className="flex shrink-0 justify-end">
          <span className="text-xs text-obr-text-secondary" title="Click in the panel first: Owlbear keeps keys typed on the map.">
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
          lights={lights.loaded ? lights : null}
          show={show}
          clear={() => setPicked(NO_SELECTION)}
          effects={effects}
          addEffect={(ids) => openAdding(ids)}
          addNote={setNoting}
          startDying={openDying}
          checkFocus={(id) => setCheckNow((c) => (c.includes(id) ? c : [...c, id]))}
        />
      )}
    </div>
  );
};

// The folded monsters' portraits, overlapping (at most five).
const Stack = ({ tokens }: { tokens: (Token | null)[] }) => (
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
