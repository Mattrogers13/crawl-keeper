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

import { onAddEffect, takeHandoff } from "../addEffectHandoff";
import { AddEffect, EditEffectContext, RowEffects, type EffectsChange } from "./Effects";
import { DeathPrompt, deathKey, owesDeathRoll, owesTimer, type DeathActions, type DeathDecision } from "./Dying";
import DyingSheet from "./DyingSheet";
import Notices from "./Notices";
import TimeSheet from "./TimeSheet";
import CrawlBar, { ClockDial, FOCUS, PlayerRoll } from "./CrawlBar";
import { clockLeft, clockStart, crawlDie, cryptoRand, darkNow, due, flipDark, forgetFlip, lastFor, replayRand, rollFor } from "../crawl";
import { dicePlusActive, rollDice, rollExploding, setDicePlusEnabled, type RollTarget } from "../diceRoller";
import { ChevronIcon, HourglassIcon, PlayIcon, PlusIcon } from "./icons";
import Loading from "./Loading";
import RowMenu from "./RowMenu";
import MonsterStack from "./MonsterStack";
import { stackKey, stackName, stacks } from "../stacks";
import { iconOf } from "../effectIcons";
import Row, { GUTTER, INIT_SLOT, tokenInfo, type ButtonProps, type Token } from "./TrackerRow";
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
  lastChanceLater,
  markDying,
  hideDeath,
  newEffectId,
  stabilize,
  statusOf,
  type Effect,
  type Effects,
} from "../effects";
import { sayDeath } from "../deathNotices";
import type { Change as HistoryChange } from "../history";
import type { Role } from "../hooks/useRole";
import { useLightStatus, useLights } from "../hooks/useLights";
import { dropSpent, followingLights, renameCarrier, type Light } from "../lights";
import { centerOn } from "../viewport";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { afterChange } from "../marker";
import { record } from "../undo";
import { NO_SELECTION, clickRow, keepRows, menuTargets, type Selection } from "../selection";
import { effectiveMode, parseSettings } from "../settings";
import { readLocal, writeLocal } from "../storage";
import { errorMessage, notify } from "../utils";
import { changePartyToken, switchParty, type Choice } from "../partyMode";
import {
  GM_ENTRY,
  gmEquation,
  inTurns,
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
// `label` ("Undo: Next turn").
// `effects`: a change to this map's effects in the same write and undo step
// (Mark dead ends focus, Reset rounds keeps rounds left).
export type ChangeOpts = { effects?: (e: Effects, before: TrackerDoc, after: TrackerDoc) => Effects };
export type Change<T = TrackerDoc> = (label: string, fn: (t: T) => T, opts?: ChangeOpts) => void;

// No lights (players: the notices tell the GM's lights only).
const NO_LIGHTS: Light[] = [];

// toolSlot: the buttons beside the title (the GM's ⏳ Time passes); titleSlot:
// beside the title, for the round count.
const Tracker = (props: { role: Role; toolSlot?: HTMLElement | null; titleSlot?: HTMLElement | null; openLights?: () => void }) => {
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
  // The effect being edited (its menu → Edit…), over the list like Add.
  const [editingEffect, setEditingEffect] = useState<string | null>(null);
  // Monster stacks this viewer opened (src/stacks.ts), by key.
  const [openStacks, setOpenStacks] = useState<string[]>([]);
  // The Party / Split switch asking who carries the party's light.
  const [carrierChoices, setCarrierChoices] = useState<Choice[] | null>(null);
  // The carrier question came from Combat: the answer starts combat too.
  const [askedByCombat, setAskedByCombat] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // The token row whose empty note the GM opened from its menu.
  const [noting, setNoting] = useState<string | null>(null);
  // The row whose token is being renamed (row menu → Rename…).
  const [renaming, setRenaming] = useState<string | null>(null);
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
  // The death timer (p. 89): this turn's decision per dying character (the
  // d20, failed, skipped or other; `DeathDecision`), and the prompt ▶ opens
  // when one is owed.
  const [deathDone, setDeathDone] = useState<Record<string, DeathDecision>>({});
  const [deathPrompt, setDeathPrompt] = useState(false);
  const [deathRolling, setDeathRolling] = useState(false);
  // A decision made from ▶'s prompt moves the turn on, once it's saved: the
  // turn it was made on (if the turn moved already, a death passed it on).
  const [moveOn, setMoveOn] = useState<string | null>(null);
  const moveOnNow = useRef<(turn: string) => void>(() => {});
  useEffect(() => {
    if (moveOn === null || deathRolling) return;
    setMoveOn(null);
    moveOnNow.current(moveOn);
  }, [moveOn, deathRolling]);
  // One sheet at a time: the newest takes over.
  const openAdding = (ids: string[] | null) => {
    if (ids) {
      setTiming(false);
      setDyingFor(null);
    }
    setAdding(ids);
  };
  // `fromNext`: ▶ opened it for the timer owed this turn; rolled, the turn moves on.
  const [timerFromNext, setTimerFromNext] = useState(false);
  const openDying = (id: string, fromNext = false) => {
    setAdding(null);
    setTiming(false);
    setDeathPrompt(false);
    setTimerFromNext(fromNext);
    setDyingFor(id);
  };
  // A dying character's turn opens its decision at once (the big prompt, or
  // the timer sheet when it's still to roll), once per turn: ✕ closes it,
  // ▶ or the notices' button opens it again. Also when the panel opens on
  // such a turn.
  const promptedTurn = useRef<string | null>(null);
  useEffect(() => {
    if (role !== "GM" || !doc.loaded || !effectsDoc.loaded) return;
    const t = doc.value;
    const turn = `${t.round}:${t.current}`;
    if (promptedTurn.current === turn) return;
    promptedTurn.current = turn;
    const owed = effectsDoc.value.effects.find((e) => owesTimer(e, t) || owesDeathRoll(e, t));
    if (!owed || deathDone[deathKey(owed.holder!, t)] !== undefined) return;
    if (owesTimer(owed, t)) openDying(owed.holder!, true);
    else {
      setAdding(null);
      setTiming(false);
      setDyingFor(null);
      setDeathPrompt(true);
    }
  }, [role, doc.loaded, effectsDoc.loaded, doc.value, effectsDoc.value, deathDone]);
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

  // The GM's flip of the darkness switch over the lights lasts until they
  // change (a light lit, or the last one out): then it's forgotten, so it
  // can't come back if they return to how they were (automatic, not an undo
  // step). Panel closed through both changes: it stays (rare).
  const lightsDark = lightStatus === "dark";
  const followingNow = followingLights(settings.value.followLight, lights.lights);
  const lastUnflip = useRef("");
  useEffect(() => {
    if (!gmReady) return;
    const unflipped = forgetFlip(docValue.crawl, followingNow, lightsDark);
    if (unflipped === docValue.crawl) return;
    const next = { ...docValue, crawl: unflipped };
    const json = JSON.stringify(next);
    if (json === lastUnflip.current) return;
    lastUnflip.current = json;
    void writeDoc(next).then((saved) => {
      if (saved) lastUnflip.current = "";
    });
  }, [gmReady, docValue, writeDoc, followingNow, lightsDark]);

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

  // A torch, spell or campfire that went out stays on its row until the turn
  // moves on (its notice too); then it's let go. Not on first showing.
  const turnSeen = useRef<string | null>(null);
  const tidyLights = lights.quiet;
  useEffect(() => {
    const turn = `${docValue.round}:${docValue.current}`;
    const before = turnSeen.current;
    turnSeen.current = turn;
    if (role === "GM" && before !== null && before !== turn) tidyLights(dropSpent);
  }, [docValue.current, docValue.round, role]);

  // The turn's row scrolls into view in a long list (UI review, 2026-11-08),
  // for everyone; only as far as needed.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector("[aria-current=step]")?.scrollIntoView?.({ block: "nearest" });
  }, [docValue.current, docValue.round]);

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
      // Not while a menu or a dialog (Who carries the light?, an (i) popup) is open.
      if (target?.closest("input, textarea, select, [role=alertdialog]") || document.querySelector("[role=menu], [role=dialog]")) return;
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
      void record(label, steps);
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
  const following = followingNow;
  const dark = darkNow(tracker.crawl, following, lightsDark);
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
  // Party | Split (and Combat's split). A light on the Party token asks who
  // carries it first; the pick runs it again.
  const runSwitch = (together: boolean, pick?: string, combat = false) => {
    if (carrierChoices && pick === undefined) return; // the question is open: answer it or cancel
    setCarrierChoices(null);
    setAskedByCombat(combat);
    switchParty(together, pick, combat ? { clearRolls: settings.value.clearRollsOnCombat } : undefined)
      .then((choices) => {
        setCarrierChoices(choices);
        if (!choices) setAskedByCombat(false);
      })
      .catch((err) => notify(`Couldn't ${together ? "bring the party together" : "split the party"}: ${errorMessage(err)}`, "ERROR"));
  };
  // The eye by the die: show or hide the rolls to players, the Settings switch
  // as an undo step.
  const toggleRolls = () => {
    const before = settings.value;
    const after = { ...before, showRolls: !before.showRolls };
    void settings.write(after).then((saved) => {
      if (saved) void record(`Setting: ${after.showRolls ? "show" : "hide"} rolls`, [{ store: "room", key: SETTINGS_KEY, before, after }]);
    });
  };
  // Renames the token itself, so the map label, the light cards and every
  // other tool follow. Not an undo step (the scene's items aren't ours to
  // restore); rename it back.
  // The token's own name; its lights' carrier name follows (notices use it).
  const renameToken = (id: string, name: string) => {
    OBR.scene.items
      .updateItems([id], (drafts) => {
        for (const d of drafts) d.name = name;
      })
      .then(() => tidyLights((s) => renameCarrier(s, id, name)))
      .catch((err) => notify(`Couldn't rename the token: ${errorMessage(err)}`, "WARNING"));
  };
  const rowProps = { gm, change: liveChange, show, focus, openMenu, openLights: gm ? (props.openLights ?? null) : null, select, checking: selection.ids.length > 0, gmMod: tracker.gmMod, gmDie: gmEquation(tracker), noting, setNoting, renaming, setRenaming, renameToken };
  const targets = menu ? tracker.entries.filter((e) => selection.ids.includes(e.id)) : [];
  const round = tracker.round;
  const roundLabel =
    round === 0 ? (gm ? "Not started" : "") : gm || settings.value.showRound ? `Round ${round}` : "";
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
  // Manual rolls: the reminder's cadence (Settings), not the danger level's.
  const every = mode === "manual" ? settings.value.remindEvery : undefined;
  // Players see the Crawling Clock unless the GM hides it; the GM sees it on the card.
  const showClock = !gm && mode === "clock" && settings.value.showClock;
  // Standard checks only: Manual has no danger level.
  const showDanger = !gm && !combat && mode === "standard" && settings.value.showDanger;
  // Manual: the GM's rolls stay the GM's.
  const playerRoll = !gm && settings.value.showRolls ? lastFor(tracker.crawl, mode) : null;
  // The encounter roll (the card's die, R, the auto roll): here, or Dice+
  // when it answered (src/diceRoller.ts), shown to players as the setting
  // says. One at a time: a second click while Dice+ rolls does nothing.
  const rollTarget: RollTarget = settings.value.showRolls ? "everyone" : "gm_only";
  const rollEncounter = (label: string) => {
    if (!dicePlusActive()) return change(label, (t) => updateCrawl(t, (c) => rollFor(mode, start, dark, every)(c, cryptoRand)));
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    const sides = mode === "clock" ? crawlDie(dark) : 6;
    const dice = mode === "clock" ? rollExploding(sides, label, rollTarget) : rollDice({ count: 1, sides, label, target: rollTarget });
    void dice
      .then((values) => liveChange(label, (t) => updateCrawl(t, (c) => rollFor(mode, start, dark, every)(c, replayRand(values, sides)))))
      .finally(() => {
        rollingRef.current = false;
        setRolling(false);
      });
  };
  // With Dice+ the auto roll takes a moment: the turn moves now, the roll
  // lands as its own step. Without it, one step as before.
  // Death rolls: in the open (p. 89), unless the GM keeps the timer to themselves.
  const deathTarget: RollTarget = settings.value.showDeath ? "everyone" : "gm_only";
  const deferRoll = mode !== "manual" && settings.value.autoRoll && dicePlusActive();
  const advance = (t: TrackerDoc) =>
    mode === "manual"
      ? nextAfterManualCheck(t, dark, every)
      : settings.value.autoRoll && !deferRoll
        ? nextWithAutoRoll(t, mode, cryptoRand, start, dark)
        : next(t);
  // A death timer that runs out at the start of this turn marks them dead
  // in the same step (skull on the row and the token; Undo brings them back).
  // The GM's death decisions (the notices' line and ▶'s prompt). On the
  // last turn (the timer is out), anything but a 20 is death.
  const nameOf = (h: string) => names.get(h) ?? "A character";
  const decide = (h: string, d: DeathDecision) => setDeathDone((all) => ({ ...all, [deathKey(h, tracker)]: d }));
  const lastChance = (h: string) => {
    const e = effects.effects.find((x) => x.icon === "dying" && x.holder === h);
    return !!e && statusOf(e, tracker).state === "ended";
  };
  const die = (h: string) => {
    liveChange(`Dead: ${nameOf(h)}`, (t) => setDead(t, [h], true), { effects: (s) => stopDying(endFocusOf(s, [h]), h) });
    void sayDeath({ event: "died", name: nameOf(h) });
  };
  const live = (h: string, label: string, fn: (s: Effects, t: TrackerDoc) => Effects, event: "rises" | "stabilized" | "healed") => {
    try {
      liveChangeEffects(`${label}: ${nameOf(h)}`, fn);
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    void sayDeath({ event, name: nameOf(h) });
  };
  // Dice+ when it answered (to everyone, or the GM alone when the death timer is kept from players).
  const rollDeathD20 = () => rollDice({ count: 1, sides: 20, label: "Death d20", target: deathTarget }).then((d) => d[0]);
  const deathActions: DeathActions = {
    rolling: deathRolling,
    timer: (h) => openDying(h, true),
    prompt: () => {
      setAdding(null);
      setTiming(false);
      setDyingFor(null);
      setDeathPrompt(true);
    },
    roll: (h) => {
      if (deathRolling) return;
      const last = lastChance(h);
      setDeathRolling(true);
      void rollDeathD20()
        .then((value) => {
          decide(h, value);
          void sayDeath({ event: "rolled", name: nameOf(h), value });
          if (value === 20) live(h, "Rises", (s) => stopDying(s, h), "rises");
          else if (last) die(h);
        })
        .finally(() => setDeathRolling(false));
    },
    nat20: (h) => {
      decide(h, 20);
      live(h, "Rises", (s) => stopDying(s, h), "rises");
    },
    failed: (h) => {
      decide(h, "failed");
      if (lastChance(h)) die(h);
    },
    stabilized: (h) => {
      decide(h, "other");
      live(h, "Stabilized", (s, t) => stabilize(s, t, newEffectId, h), "stabilized");
    },
    healed: (h) => {
      decide(h, "other");
      live(h, "Healed", (s) => stopDying(s, h), "healed");
    },
    dead: (h) => {
      decide(h, "other");
      die(h);
    },
  };
  // From ▶'s prompt: decide, close, and move the turn on (not after a death:
  // marking the current token dead already passes the turn; nor while the
  // d20 is still rolling, or when it killed them).
  const fromPrompt = (h: string, act: (h: string) => void, moveOnAfter: boolean) => {
    act(h);
    setDeathPrompt(false);
    if (moveOnAfter) setMoveOn(`${tracker.round}:${tracker.current}`);
  };
  // Skip for now: undecided this turn; on the last chance they stay dying
  // until their next turn (one undo step).
  const skipDeath = (h: string) => {
    decide(h, "skip");
    if (lastChance(h)) liveChangeEffects(`Skip: ${nameOf(h)}'s last chance`, (s, t) => lastChanceLater(s, t, h));
  };
  // Row menu → Dying…: on their own turn the timer is rolled now; otherwise
  // they're marked dying and roll it on their turn (p. 89).
  const dyingFromMenu = (h: string) => {
    if (tracker.current === h) return openDying(h);
    try {
      liveChangeEffects(`Dying: ${nameOf(h)}`, (s, t) => markDying(s, t, newEffectId, h));
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    void sayDeath({ event: "down", name: nameOf(h) });
  };
  const promptActions: DeathActions = {
    ...deathActions,
    roll: (h) => fromPrompt(h, deathActions.roll, true),
    nat20: (h) => fromPrompt(h, deathActions.nat20, true),
    failed: (h) => fromPrompt(h, deathActions.failed, !lastChance(h)),
    stabilized: (h) => fromPrompt(h, deathActions.stabilized, true),
    healed: (h) => fromPrompt(h, deathActions.healed, true),
    dead: (h) => fromPrompt(h, deathActions.dead, false),
  };


  // A dying character's turn owes the death d20 (their last turn too):
  // ▶ asks for the decision first, then moves on.
  const owedDeath = () =>
    effects.effects.find((e) => (owesDeathRoll(e, tracker) || owesTimer(e, tracker)) && deathDone[deathKey(e.holder!, tracker)] === undefined) ?? null;
  const goNext = () => {
    const owed = owedDeath();
    if (owed) return owesTimer(owed, tracker) ? openDying(owed.holder!, true) : setDeathPrompt(true);
    const moved = next(tracker);
    change("Next turn", advance);
    if (deferRoll && moved.phase === "crawl" && moved.current === GM_ENTRY && due(moved.crawl, mode, dark)) rollEncounter(mode === "clock" ? "Crawling die" : "Encounter check");
  };
  const turnNow = `${tracker.round}:${tracker.current}`;
  moveOnNow.current = (turn) => {
    if (turn === turnNow && !owedDeath()) goNext();
  };
  hotkeys.current = {
    n: goNext,
    b: () => change("Back", previous),
    r: () => {
      if (!combat && due(tracker.crawl, mode, dark, every)) rollEncounter("Encounter roll");
    },
  };
  const drop = ({ active, over }: DragEndEvent) => {
    if (over) change("Move row", (t) => moveTo(t, String(active.id), String(over.id)));
  };

  // Edit… on an effect: the Add sheet, filled in (one sheet at a time).
  const openEdit = (id: string) => {
    setAdding(null);
    setTiming(false);
    setDyingFor(null);
    setDeathPrompt(false);
    setEditingEffect(id);
  };
  const edited = editingEffect === null ? null : (effects.effects.find((e) => e.id === editingEffect) ?? null);
  return (
    <EditEffectContext.Provider value={gm ? openEdit : null}>
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
              title="Combat: encounter checks pause"
              className={`h-8 rounded-full px-4 ${combat ? "bg-red-700 text-white" : "hover:bg-obr-text/10"}`}
              // Combat splits a party that's together (Matt, 2026-11-07), in the same step.
              onClick={() => (tracker.party !== null && tracker.together ? runSwitch(false, undefined, true) : change("Combat", (t) => toCombat(t, settings.value.clearRollsOnCombat)))}
            >
              Combat
            </button>
          </div>
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
      {gm && tracker.party !== null && (
        <PartySwitch
          together={tracker.together}
          choices={carrierChoices}
          go={(together, pick) => runSwitch(together, pick, !together && pick !== undefined && askedByCombat)}
          cancel={() => {
            setCarrierChoices(null);
            setAskedByCombat(false);
          }}
        />
      )}

      {/* The phase and round, beside the title. The GM's opens a menu:
          Reset rounds (it was a link under the turn bar until 2026-11-08). */}
      {titleSlot &&
        createPortal(
          <PhasePill
            combat={combat}
            round={roundLabel}
            resetRounds={gm ? () => change("Reset rounds", resetRounds, { effects: resetEffectRounds }) : undefined}
          />,
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
          every={every}
          gmTurn={tracker.current === GM_ENTRY}
          dark={dark}
          following={following}
          flipDark={() => change(dark ? "Torchlit" : "Darkness", (t) => updateCrawl(t, (c) => flipDark(c, following, lightsDark)))}
          change={(label, fn, opts) => change(label, (t) => updateCrawl(t, fn), opts)}
          roll={rollEncounter}
          rolling={rolling}
          toggleRolls={toggleRolls}
          seen={{
            clock: mode === "clock" && settings.value.showClock,
            danger: mode === "standard" && settings.value.showDanger,
            rolls: settings.value.showRolls,
          }}
        />
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
        deathDone={deathDone}
        deathActions={gm ? deathActions : null}
      />
      {/* The GM's + and ⏳ beside the title: a free-standing effect (a row's
          own: its menu), and the Time passes sheet. */}
      {gm &&
        toolSlot &&
        createPortal(
          <>
          <button
            type="button"
            aria-label="Add effect"
            aria-expanded={adding !== null && adding.length === 0}
            title="Add an effect (a row's own: its ⋯ menu)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
            onClick={() => openAdding([])}
          >
            <PlusIcon />
          </button>
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
          </button>
          </>,
          toolSlot,
        )}

      {/* Only the list scrolls: the controls above stay in view. */}
      <div className="relative -mx-1 flex min-h-0 flex-1 flex-col">
      {/* The Add effects and Time passes sheets cover the list while open (the panel is short). */}
      {gm && (adding || timing || dyingFor || deathPrompt || edited) && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-obr-paper px-1">
          {deathPrompt ? (
            <DeathPrompt
              dying={effects.effects.filter((e) => owesDeathRoll(e, tracker))}
              tracker={tracker}
              names={names}
              actions={promptActions}
              skip={(h) => fromPrompt(h, skipDeath, true)}
              close={() => setDeathPrompt(false)}
            />
          ) : edited ? (
            <AddEffect
              key={edited.id}
              editing={edited}
              holders={edited.holder === null ? [] : [edited.holder]}
              names={names}
              tracker={tracker}
              effects={effects}
              change={changeEffects}
              close={() => setEditingEffect(null)}
            />
          ) : adding ? (
            <AddEffect key={adding.join()} holders={adding} names={names} tracker={tracker} effects={effects} change={changeEffects} close={() => setAdding(null)} />
          ) : dyingFor ? (
            <DyingSheet
              key={dyingFor}
              holder={dyingFor}
              name={names.get(dyingFor) ?? "A character"}
              change={liveChangeEffects}
              close={() => setDyingFor(null)}
              done={() => {
                setDyingFor(null);
                if (!timerFromNext) return;
                decide(dyingFor, "other");
                setMoveOn(`${tracker.round}:${tracker.current}`);
              }}
              skip={
                timerFromNext
                  ? () => {
                      setDyingFor(null);
                      decide(dyingFor, "skip");
                      setMoveOn(`${tracker.round}:${tracker.current}`);
                    }
                  : undefined
              }
              rollD4={() => rollDice({ count: 1, sides: 4, label: "Death timer", target: deathTarget }).then((d) => d[0])}
            />
          ) : (
            <TimeSheet lights={lights.lights} effects={effects} change={lights.change} names={names} close={() => setTiming(false)} />
          )}
        </div>
      )}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-1 pt-px" inert={gm && (adding || timing || dyingFor || deathPrompt || edited) ? true : undefined}>
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
            aria-hidden={gm ? undefined : true}
          >
            {/* Lined up with the names: the GM's grip, checkbox (touch only) and portrait
                (16 + 16 + 26 px and 8 px gaps), or a player's inset and portrait (4 + 26 + 8). */}
            <span className={`flex-1 ${gm ? GUTTER.header : "pl-[38px]"}`}>Name</span>
            {/* Possible deletion (docs/design.md, Releases): rolls already sort the list as they are entered, so this may go unused. */}
            {gm ? (
              <span className={`${INIT_SLOT} pr-2 text-right`}>
                <button
                  type="button"
                  title="Sort by roll, highest first"
                  className="cursor-pointer uppercase underline decoration-dotted underline-offset-2 hover:text-obr-text focus-visible:text-obr-text focus-visible:outline-none"
                  onClick={() => change("Sort by roll", sortByRoll)}
                >
                  Init
                </button>
              </span>
            ) : (
              <span className={`${INIT_SLOT} pr-2 text-right`}>Init</span>
            )}
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
                  party={entry.id === tracker.party}
                  sitsOut={!inTurns(tracker, entry)}
                  {...rowProps}
                >
                  {entry.id === GM_ENTRY && monsters.length > 0 && (
                    <SortableContext items={monsters.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex h-7 items-center border-b border-obr-text/10 pr-2">
                        <button
                          type="button"
                          aria-expanded={showMonsters}
                          aria-label={showMonsters ? "Fold the monsters" : `Show ${monsters.length} monsters`}
                          disabled={monsterTurn}
                          title={monsterTurn ? "Shown while a monster has the turn" : undefined}
                          className={`flex h-full min-w-0 flex-1 items-center gap-1.5 text-[11px] font-medium tracking-[0.04em] text-obr-text-secondary enabled:hover:text-obr-text ${
                            gm ? GUTTER.fold : "pl-2.5"
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
                        {/* After a fight: clear the monsters out (kept until then, so a
                            fight can resume). Was a link under the turn bar until 2026-11-08. */}
                        {gm && !combat && (
                          <button
                            type="button"
                            aria-label="Remove monsters"
                            title="Remove every monster from the tracker"
                            className="text-[11px] text-obr-text-secondary underline hover:text-obr-text"
                            onClick={() => change("Remove monsters", removeMonsters)}
                          >
                            Remove all
                          </button>
                        )}
                      </div>
                      {showMonsters && (
                        <ol aria-label="Monsters" className="flex flex-col">
                          {stacks(monsters, (m) => stackKey(tokenFor(m)?.name ?? "", tokenFor(m)?.image ?? null)).map((st) => {
                            const row = (m: Entry) => (
                              <Row key={m.id} effects={rowEffects(m)} {...lightProps(m)} entry={m} token={tokenFor(m)} current={m.id === current} selected={selection.ids.includes(m.id)} small {...rowProps} />
                            );
                            if (st.members.length === 1) return row(st.members[0]);
                            const ids = st.members.map((m) => m.id);
                            const hasTurn = current !== null && ids.includes(current);
                            return (
                              <MonsterStack
                                key={st.key}
                                name={stackName(tokenFor(st.members[0])?.name ?? "")}
                                tokens={st.members.map(tokenFor)}
                                dead={st.members.filter((m) => m.dead).length}
                                icons={[...new Set(st.members.flatMap((m) => (effectsOf.get(m.id) ?? []).map(iconOf)))]}
                                open={hasTurn || openStacks.includes(st.key)}
                                current={hasTurn}
                                toggle={() => setOpenStacks((o) => (o.includes(st.key) ? o.filter((k) => k !== st.key) : [...o, st.key]))}
                                gm={gm}
                                openMenu={
                                  gm
                                    ? (x, y) => {
                                        setPicked({ ids, anchor: ids[0] });
                                        setMenu({ x, y });
                                      }
                                    : undefined
                                }
                              >
                                {st.members.map(row)}
                              </MonsterStack>
                            );
                          })}
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
            Right-click a token on the map: Crawl Keeper → Add to initiative. Right-click a row here (or hover it for ⋯) to mark
            monsters; drag its grip to move it. Click a roll to edit it. Keys (click in the panel first): N next · B back · R roll.
          </p>
        )}
      </div>
      </div>
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
          effects={settle(effects, tracker)}
          addEffect={(ids) => openAdding(ids)}
          addNote={setNoting}
          rename={setRenaming}
          party={tracker.party}
          setParty={(id) => void changePartyToken(id).catch((err) => notify(`Couldn't change the party token: ${errorMessage(err)}`, "ERROR"))}
          startDying={dyingFromMenu}
          checkFocus={(id) => setCheckNow((c) => (c.includes(id) ? c : [...c, id]))}
        />
      )}
    </div>
    </EditEffectContext.Provider>
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
// The phase and round beside the key. The GM's is a button with a small menu
// (Reset rounds; UI review, 2026-11-08: the links row under the turn bar went).
// The menu is fixed to the page: the header's slot clips what overflows it.
const PhasePill = (props: { combat: boolean; round: string; resetRounds?: () => void }) => {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && e.target instanceof Element && e.target.closest("[data-phase-menu]")) return;
      setAt(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [at]);
  const look = `flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${
    props.combat ? "bg-red-600/15 text-red-700 dark:text-red-300" : "bg-obr-primary/15 text-obr-text"
  }`;
  const inside = (
    <>
      <span className={`h-1.5 w-1.5 rounded-full ${props.combat ? "bg-red-600 dark:bg-red-400" : "bg-obr-primary"}`} aria-hidden />
      <span>{props.combat ? "Combat" : "Crawl"}</span>
      {props.round && (
        <>
          <span aria-hidden>·</span>
          <span className="text-obr-text">{props.round}</span>
        </>
      )}
    </>
  );
  if (!props.resetRounds) return <span className={look}>{inside}</span>;
  const reset = props.resetRounds;
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        aria-label={`Round menu: ${props.combat ? "Combat" : "Crawl"}${props.round ? `, ${props.round}` : ""}`}
        title="Round menu: Reset rounds"
        className={`${look} hover:brightness-125 ${FOCUS}`}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: box.left, y: box.bottom + 4 });
        }}
      >
        {inside}
      </button>
      {at &&
        createPortal(
          <div
            role="menu"
            aria-label="Round"
            data-phase-menu
            style={{ left: at.x, top: at.y }}
            className="fixed z-50 min-w-[160px] rounded-lg bg-obr-paper py-1 text-sm shadow-lg ring-1 ring-obr-text/15"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left hover:bg-obr-text/10"
              onClick={() => {
                setAt(null);
                reset();
              }}
            >
              Reset rounds
              <span className="block text-[11px] text-obr-text-secondary">Back to 0; encounter checks start over</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

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

// Party | Split under the turn bar (only with a Party token): together, the
// Party token takes the turns and the players sit out; split, the reverse.
// Splitting with a light on the Party token asks who carries it.
const PartySwitch = (props: {
  together: boolean;
  choices: Choice[] | null;
  go: (together: boolean, pick?: string) => void;
  cancel: () => void;
}) => {
  const { together, choices } = props;
  const seg = (on: boolean, label: string, hint: string, click: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      title={hint}
      className={`h-7 rounded-full px-3 ${on ? "bg-obr-primary text-obr-primary-contrast" : "hover:bg-obr-text/10"}`}
      onClick={click}
    >
      {label}
    </button>
  );
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Party or split" className="flex rounded-full bg-obr-bg p-[3px] text-xs font-medium">
          {seg(together, "Party", "The Party token takes the turns; the players sit out", () => !together && props.go(true))}
          {seg(!together, "Split", "The players take the turns; the Party token sits out", () => together && props.go(false))}
        </div>
        <span className="text-xs text-obr-text-secondary">{together ? "Party token has the turns" : "Players have the turns"}</span>
      </div>
      {/* A dialog over the panel: inline under the switch it was easy to miss,
          and each press redrew it (Matt's "flicker", 2026-11-07). */}
      {choices && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-16" onPointerDown={(e) => e.target === e.currentTarget && props.cancel()}>
          <div
            role="dialog"
            aria-label="Who carries the light"
            className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-obr-paper p-4 text-sm shadow-xl ring-1 ring-obr-text/10"
            onKeyDown={(e) => e.key === "Escape" && props.cancel()}
          >
            <h2 className="text-base font-semibold">Who carries the light?</h2>
            <p className="text-xs text-obr-text-secondary">The party token's light goes to this player when the party splits, timer and all. Next time they're asked first.</p>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  autoFocus={i === 0}
                  className="h-8 rounded-md px-3 font-medium ring-1 ring-obr-text/15 ring-inset hover:bg-obr-text/10 focus-visible:ring-2 focus-visible:ring-obr-primary focus-visible:outline-none"
                  onClick={() => props.go(false, c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <button type="button" className="h-8 self-end rounded-md px-3 text-obr-text-secondary hover:bg-obr-text/10" onClick={props.cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
