// Effects: focus, conditions and timed effects (docs/effects.md). One scene
// doc per map, written only by the GM. Pure functions only (no SDK, no
// React) so every rule here is unit-tested.
//
// An effect is a tag (a name, an optional condition icon) with an optional
// holder token and a duration: rounds, focus (while the holder focuses,
// p. 50) or until removed. Light sources stay in the Light Tracker.
//
// Timing is derived on read, like `isDark`: nothing is written when ▶ or ◀
// moves the turn. A rounds effect stores where it ends: `{ round, at }`, the
// start of row `at`'s turn in that round (null `at`: the round's top). An
// effect added during round R on X's turn for N rounds ends at the start of
// X's turn in round R + N (p. 83: a timer counts down on one creature's
// turn). Added between rounds, the next round is R: it ends in R + 1 + N.
// So ◀ brings an effect back and undo needs nothing extra.

import type { Rand } from "./crawl";
import { rollDie } from "./crawl";
import { intIn, isObject, MAX_COUNT } from "./parse";
import { GM_ENTRY, turnOrder, type Tracker } from "./tracker";

// Conditions with an icon (docs/effects.md, picked by how often the book
// uses them). Focus is the icon of every focus effect and of nothing else.
export type Condition = "dying" | "focus" | "adv" | "dis" | "blinded" | "paralyzed" | "invisible" | "stuck" | "unconscious";
// Dying is first so its map icon is never folded into the "+".
export const CONDITIONS: Record<Condition, { label: string; hint?: string }> = {
  dying: { label: "Dying", hint: "Dies when the timer runs out; a natural 20 on the d20 rises with 1 HP (p. 89)" },
  focus: { label: "Focus", hint: "A spellcasting check at the start of each turn keeps it (p. 50)" },
  adv: { label: "ADV", hint: "Advantage and disadvantage cancel each other (p. 77)" },
  dis: { label: "DIS", hint: "Advantage and disadvantage cancel each other (p. 77)" },
  blinded: { label: "Blinded" },
  paralyzed: { label: "Paralyzed" },
  invisible: { label: "Invisible" },
  stuck: { label: "Stuck" },
  unconscious: { label: "Unconscious" },
};
export const CONDITION_IDS = Object.keys(CONDITIONS) as Condition[];

// Rolled durations: one roll for every holder added together.
export type Dice = "1d4" | "1d6" | "1d8" | "1d10" | "2d4";
export const DICE: Record<Dice, { count: number; sides: number }> = {
  "1d4": { count: 1, sides: 4 },
  "1d6": { count: 1, sides: 6 },
  "1d8": { count: 1, sides: 8 },
  "1d10": { count: 1, sides: 10 },
  "2d4": { count: 2, sides: 4 },
};
export const DICE_IDS = Object.keys(DICE) as Dice[];

export type Kind = "rounds" | "focus" | "until";

export const MAX_EFFECTS = 24;
export const NAME_MAX = 32;
export const ROUNDS_MAX = 99;
const ID_MAX = 64;
// Ends can sit a little past the tracker's round cap (an effect added late).
const END_MAX = MAX_COUNT + ROUNDS_MAX + 1;

export type End = { round: number; at: string | null };

export type Effect = {
  // Ours (newEffectId), short: there are up to 24 per scene.
  id: string;
  name: string;
  icon: Condition | null;
  // A token id; null: free-standing (Cloudkill, a collapsing ceiling).
  holder: string | null;
  kind: Kind;
  // Rounds effects: the length when added (shown "of N") and where it ends;
  // dice when rolled (`rounds` is the roll). 0 / null for the other kinds.
  rounds: number;
  end: End | null;
  dice: Dice | null;
  // A focus effect this one ends with (Paralyzed on the goblin ends when the
  // wizard's Hold Person focus does). Never set on a focus effect.
  endsWith: string | null;
  // GM only. The UI hides it from players; shared data has no secrecy.
  hidden: boolean;
};

export type Effects = { effects: Effect[] };

export const emptyEffects = (): Effects => ({ effects: [] });

// --- Timing --------------------------------------------------------------

// Positions in a round: -1 is its top, then each turn's index in the turn
// order. Between rounds (before the first ▶, after a phase switch) the
// tracker waits at the next round's top: that top has come, its first turn
// hasn't.
const TOP = -1;
type Now = { round: number; index: number };
const nowOf = (t: Tracker): Now => {
  if (t.current === null) return { round: t.round + 1, index: TOP };
  return { round: t.round, index: turnOrder(t).findIndex((e) => e.id === t.current) };
};

// The index in the turn order where row `id`'s turn starts. The round's top
// (TOP) when `id` is null or not in initiative. A monster while crawling acts
// in the GM / Monsters turn. A dead row's turn passes to the next living
// one (past the last: the round's end, the turn order's length).
export const slotOf = (t: Tracker, id: string | null): number => {
  const order = turnOrder(t);
  const entry = id === null ? undefined : t.entries.find((e) => e.id === id);
  if (!entry) return TOP;
  if (entry.monster && t.phase === "crawl") return order.findIndex((e) => e.id === GM_ENTRY);
  const living = new Set(order.map((e) => e.id));
  const all = turnOrder({ ...t, entries: t.entries.map((e) => (e.id === id ? { ...e, dead: false } : e)) });
  return all.slice(0, all.findIndex((e) => e.id === id)).filter((e) => living.has(e.id)).length;
};

// Rounds left: how many of the counting row's turn starts are still to
// come before (and including) the end. 1 is the last round; 0 or less, it
// has ended.
const leftAt = (end: End, t: Tracker, now: Now) => end.round - now.round + (now.index < slotOf(t, end.at) ? 1 : 0);

export type Status =
  | { state: "active"; left: number | null }
  // Ended on this very turn: shown "ended" through it, then gone.
  | { state: "ended" }
  | { state: "gone" };

export const statusOf = (e: Effect, t: Tracker): Status => {
  if (e.kind !== "rounds" || !e.end) return { state: "active", left: null };
  const now = nowOf(t);
  const left = leftAt(e.end, t, now);
  if (left > 0) return { state: "active", left };
  // In its last round, at or before the turn it ended on (an end at the top
  // shows through the round's first turn).
  return now.round === e.end.round && now.index <= Math.max(slotOf(t, e.end.at), 0) ? { state: "ended" } : { state: "gone" };
};

// What the panel lists: everything but effects already gone.
export const shown = (s: Effects, t: Tracker): Effect[] => s.effects.filter((e) => statusOf(e, t).state !== "gone");

// Where a new effect counted on `at` ends after `rounds` rounds.
const endFor = (t: Tracker, at: string | null, rounds: number): End => {
  const now = nowOf(t);
  // A count still to come this round (the row's turn hasn't started) is the
  // first of the N; otherwise the first is next round's.
  return { round: now.round + rounds - (now.index < slotOf(t, at) ? 1 : 0), at };
};

// --- Reminders -----------------------------------------------------------

// Focus checks due at the start of this turn (p. 50): the current row's
// focus, or on the GM / Monsters turn while crawling, every focusing
// monster's.
export const focusChecks = (s: Effects, t: Tracker): Effect[] => {
  if (t.current === null) return [];
  const monsters = new Set(t.entries.filter((e) => e.monster).map((e) => e.id));
  const crawlGm = t.phase === "crawl" && t.current === GM_ENTRY;
  return s.effects.filter((e) => e.kind === "focus" && (e.holder === t.current || (crawlGm && e.holder !== null && monsters.has(e.holder))));
};

// Rounds effects ending on this turn.
export const endingNow = (s: Effects, t: Tracker): Effect[] => s.effects.filter((e) => statusOf(e, t).state === "ended");

// The focus a token holds, if any.
export const focusOf = (s: Effects, holder: string) => s.effects.find((e) => e.kind === "focus" && e.holder === holder) ?? null;

// --- Changes -------------------------------------------------------------
// Each returns the same object when nothing changed (no write). Bad input
// throws: the UI only offers what's allowed.

// The holder already focuses; the UI asks first ("End Hold Person, focus on
// Web?") and adds again with `replaceFocus`.
export class AlreadyFocusingError extends Error {
  constructor(readonly focus: Effect) {
    super(`Already focusing on ${focus.name}`);
    this.name = "AlreadyFocusingError";
  }
}

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newEffectId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ID_CHARS[b % ID_CHARS.length]).join("");

// Removed effects take what ends with them along (no chains: a focus effect
// never ends with another).
const without = (s: Effects, ids: Set<string>): Effects => {
  if (ids.size === 0) return s;
  const effects = s.effects.filter((e) => !ids.has(e.id) && !(e.endsWith !== null && ids.has(e.endsWith)));
  return effects.length === s.effects.length ? s : { ...s, effects };
};

// Effects already gone leave the doc with the next write.
export const settle = (s: Effects, t: Tracker): Effects =>
  without(s, new Set(s.effects.filter((e) => statusOf(e, t).state === "gone").map((e) => e.id)));

export type Duration = { kind: "rounds"; rounds: number } | { kind: "rounds"; dice: Dice } | { kind: "focus" } | { kind: "until" };

export type NewEffect = {
  name: string;
  icon?: Condition | null;
  // One effect per holder; none: one free-standing effect.
  holders?: string[];
  duration: Duration;
  // The row whose turn starts count it down; default the row whose turn it
  // is now; null: the round's top.
  countsOn?: string | null;
  endsWith?: string | null;
  hidden?: boolean;
  // Holders already focusing end that focus (and what ends with it) first.
  replaceFocus?: boolean;
};

export const rollDice = (dice: Dice, rand: Rand) => {
  const { count, sides } = DICE[dice];
  let total = 0;
  for (let i = 0; i < count; i++) total += rollDie(sides, rand);
  return total;
};

export const addEffects = (state: Effects, t: Tracker, newId: () => string, rand: Rand, input: NewEffect): Effects => {
  const { duration } = input;
  const focus = duration.kind === "focus";
  const holders = [...new Set(input.holders ?? [])];
  if (holders.some((h) => !h || h === GM_ENTRY || h.length > ID_MAX)) throw new TypeError("Effects go on tokens");
  if (focus && holders.length === 0) throw new TypeError("Focus needs a caster");
  if (input.icon && !CONDITION_IDS.includes(input.icon)) throw new TypeError(`Unknown condition: ${input.icon}`);
  if (input.icon === "focus" && !focus) throw new TypeError("The focus icon is for focus effects");
  const icon = focus ? "focus" : (input.icon ?? null);
  const name = input.name.trim().slice(0, NAME_MAX) || (icon ? CONDITIONS[icon].label : "");
  if (!name) throw new TypeError("An effect needs a name");

  let rounds = 0;
  let dice: Dice | null = null;
  if (duration.kind === "rounds") {
    if ("dice" in duration) {
      if (!DICE_IDS.includes(duration.dice)) throw new TypeError(`Unknown dice: ${duration.dice}`);
      dice = duration.dice;
      rounds = rollDice(dice, rand);
    } else {
      rounds = duration.rounds;
      if (!Number.isInteger(rounds) || rounds < 1 || rounds > ROUNDS_MAX) throw new RangeError(`1 to ${ROUNDS_MAX} rounds`);
    }
  }

  let s = settle(state, t);
  const focusing = holders.map((h) => focusOf(s, h)).filter((f) => f !== null);
  if (focus && focusing.length > 0) {
    if (!input.replaceFocus) throw new AlreadyFocusingError(focusing[0]);
    s = without(s, new Set(focusing.map((f) => f.id)));
  }
  const endsWith = input.endsWith ?? null;
  if (endsWith !== null && (focus || !s.effects.some((e) => e.id === endsWith && e.kind === "focus")))
    throw new TypeError("Only a non-focus effect can end with a focus");
  const count = Math.max(1, holders.length);
  if (s.effects.length + count > MAX_EFFECTS) throw new RangeError(`Up to ${MAX_EFFECTS} effects on a map; remove one first`);

  const countsOn = input.countsOn === undefined ? t.current : input.countsOn;
  const end = duration.kind === "rounds" ? endFor(t, countsOn, rounds) : null;
  const made = (holders.length ? holders : [null]).map(
    (holder): Effect => ({ id: newId(), name, icon, holder, kind: duration.kind, rounds, end, dice, endsWith, hidden: input.hidden === true }),
  );
  return { ...s, effects: [...s.effects, ...made] };
};

export const removeEffects = (s: Effects, ids: string[]): Effects => without(s, new Set(ids));

// The focus check failed (Lost or Nat 1): the focus ends, and what ends with it.
export const endFocus = (s: Effects, id: string): Effects =>
  s.effects.some((e) => e.id === id && e.kind === "focus") ? without(s, new Set([id])) : s;

// Marking rows dead ends their focus (in the same undo step).
export const endFocusOf = (s: Effects, holders: string[]): Effects => {
  const dying = new Set(holders);
  return without(s, new Set(s.effects.filter((e) => e.kind === "focus" && e.holder !== null && dying.has(e.holder)).map((e) => e.id)));
};

// Deleted tokens take their effects along (automatic, not an undo step).
export const pruneEffects = (s: Effects, exists: (id: string) => boolean): Effects =>
  without(s, new Set(s.effects.filter((e) => e.holder !== null && !exists(e.holder)).map((e) => e.id)));

// The GM edits a rounds effect's rounds left (1 to 99), from now.
export const setRoundsLeft = (s: Effects, t: Tracker, id: string, left: number): Effects => {
  if (!Number.isInteger(left) || left < 1 || left > ROUNDS_MAX) throw new RangeError(`1 to ${ROUNDS_MAX} rounds`);
  const e = s.effects.find((x) => x.id === id);
  if (!e || e.kind !== "rounds" || !e.end) return s;
  const end = endFor(t, e.end.at, left);
  if (end.round === e.end.round) return s;
  return { ...s, effects: s.effects.map((x) => (x === e ? { ...x, end } : x)) };
};

// Reset rounds: `before` is the tracker before its reset. Every rounds
// effect keeps the rounds it had left; ended ones go.
export const resetEffectRounds = (s: Effects, before: Tracker, after: Tracker): Effects => {
  let changed = false;
  const effects = s.effects.flatMap((e) => {
    if (e.kind !== "rounds" || !e.end) return [e];
    const st = statusOf(e, before);
    changed = true;
    if (st.state !== "active") return [];
    return [{ ...e, end: endFor(after, e.end.at, st.left!) }];
  });
  return changed ? { ...s, effects } : s;
};

// Time passes (p. 82: minutes pass, effects counted in rounds expire). Focus
// and until-removed effects stay.
// Dying stays: time passing over a dying character is the GM's call.
export const timePassesEffects = (s: Effects): Effects =>
  without(s, new Set(s.effects.filter((e) => e.kind === "rounds" && e.icon !== "dying").map((e) => e.id)));

// --- The death timer (p. 89) ------------------------------------------------
// A character at 0 HP is dying: on their turn they roll 1d4 + CON (at least
// 1) and die in that many rounds unless healed or stabilized; on each later
// turn a d20, a natural 20 rises with 1 HP. Player rows only: monsters at 0
// just die. One Dying effect per token, never hidden (everyone sees it).

export const deathTimer = (d4: number, con: number) => Math.max(1, Math.trunc(d4) + Math.trunc(con));

export const dyingOf = (s: Effects, holder: string) => s.effects.find((e) => e.icon === "dying" && e.holder === holder) ?? null;

// Can this row start dying? A living player token not already dying.
export const canDie = (s: Effects, t: Tracker, holder: string) => {
  const entry = t.entries.find((e) => e.id === holder);
  return !!entry && holder !== GM_ENTRY && !entry.monster && !entry.dead && !dyingOf(s, holder);
};

// The timer counts from the turn it's rolled on: on the holder's own turn
// that's now; otherwise their next turn is the rolling turn (one more). On
// the rolling turn N rounds are left; it ends at the start of their turn N
// rounds later, so they get N - 1 d20s.
export const startDying = (state: Effects, t: Tracker, newId: () => string, holder: string, rounds: number): Effects => {
  if (!canDie(state, t, holder)) throw new TypeError("Only a living player token that isn't dying can start dying");
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > ROUNDS_MAX) throw new RangeError(`1 to ${ROUNDS_MAX} rounds`);
  const s = settle(state, t);
  if (s.effects.length + 1 > MAX_EFFECTS) throw new RangeError(`Up to ${MAX_EFFECTS} effects on a map; remove one first`);
  const end = endFor(t, holder, t.current === holder ? rounds : rounds + 1);
  const dying: Effect = { id: newId(), name: "Dying", icon: "dying", holder, kind: "rounds", rounds, end, dice: null, endsWith: null, hidden: false };
  return { ...s, effects: [...s.effects, dying] };
};

export const stopDying = (s: Effects, holder: string): Effects => {
  const d = dyingOf(s, holder);
  return d ? without(s, new Set([d.id])) : s;
};

// Stabilized (DC 15 INT first aid): no longer dying, still unconscious.
export const stabilize = (s: Effects, t: Tracker, newId: () => string, holder: string): Effects => {
  const stopped = stopDying(s, holder);
  if (stopped === s) return s;
  const unconscious: Effect = { id: newId(), name: "Unconscious", icon: "unconscious", holder, kind: "until", rounds: 0, end: null, dice: null, endsWith: null, hidden: false };
  return { ...stopped, effects: [...settle(stopped, t).effects, unconscious] };
};

// The d20 is offered on the holder's turn after the rolling turn.
export const deathRollDue = (e: Effect, t: Tracker) => {
  if (e.icon !== "dying" || t.current !== e.holder) return false;
  const st = statusOf(e, t);
  return st.state === "active" && st.left !== null && st.left < e.rounds;
};

// Undo / redo of one step (undo.ts): put back only the effects the step
// changed, over the doc as it is now. Parsing afterwards drops what no
// longer holds together (an effect whose focus is gone).
export const restoreEffects = (current: Effects, from: Effects, to: Effects): Effects => {
  const byId = (s: Effects) => new Map(s.effects.map((e) => [e.id, e]));
  const was = byId(from);
  const will = byId(to);
  const touched = new Set([...was.keys(), ...will.keys()].filter((id) => JSON.stringify(was.get(id)) !== JSON.stringify(will.get(id))));
  const effects = current.effects.filter((e) => !touched.has(e.id) || will.has(e.id)).map((e) => (touched.has(e.id) ? will.get(e.id)! : e));
  for (const id of touched) if (will.has(id) && !effects.some((e) => e.id === id)) effects.push(will.get(id)!);
  return parseEffects({ effects });
};

// What a player sees: no hidden effects, nor those on tokens hidden from them.
export const playerEffects = (s: Effects, visible: (id: string) => boolean): Effects => {
  const effects = s.effects.filter((e) => !e.hidden && (e.holder === null || visible(e.holder)));
  return effects.length === s.effects.length ? s : { ...s, effects };
};

// --- Parsing -------------------------------------------------------------
// Scene metadata is untrusted (any client, any extension): malformed effects
// drop, numbers must be in range, the rules above hold after parsing.

const idOrNull = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= ID_MAX ? v : null);

const parseEnd = (raw: unknown): End | null => {
  if (!isObject(raw)) return null;
  const round = intIn(raw.round, 0, END_MAX);
  return round === null ? null : { round, at: idOrNull(raw.at) };
};

export const parseEffect = (raw: unknown): Effect | null => {
  if (!isObject(raw)) return null;
  const id = idOrNull(raw.id);
  const kind = raw.kind;
  if (!id || (kind !== "rounds" && kind !== "focus" && kind !== "until")) return null;
  const holder = idOrNull(raw.holder);
  if (kind === "focus" && !holder) return null;
  const icon = kind === "focus" ? "focus" : typeof raw.icon === "string" && CONDITION_IDS.includes(raw.icon as Condition) && raw.icon !== "focus" ? (raw.icon as Condition) : null;
  const name = (typeof raw.name === "string" ? raw.name.trim().slice(0, NAME_MAX) : "") || (icon ? CONDITIONS[icon].label : "");
  if (!name) return null;
  let rounds = 0;
  let end: End | null = null;
  let dice: Dice | null = null;
  if (kind === "rounds") {
    const r = intIn(raw.rounds, 1, ROUNDS_MAX);
    end = parseEnd(raw.end);
    if (r === null || !end) return null;
    rounds = r;
    dice = typeof raw.dice === "string" && DICE_IDS.includes(raw.dice as Dice) ? (raw.dice as Dice) : null;
  }
  return { id, name, icon, holder, kind, rounds, end, dice, endsWith: kind === "focus" ? null : idOrNull(raw.endsWith), hidden: raw.hidden === true };
};

export const parseEffects = (raw: unknown): Effects => {
  if (!isObject(raw) || !Array.isArray(raw.effects)) return emptyEffects();
  const seen = new Set<string>();
  const focusing = new Set<string>();
  const effects: Effect[] = [];
  for (const item of raw.effects) {
    const e = parseEffect(item);
    if (!e || seen.has(e.id)) continue;
    // One focus per holder: a second is dropped.
    if (e.kind === "focus" && focusing.has(e.holder!)) continue;
    seen.add(e.id);
    if (e.kind === "focus") focusing.add(e.holder!);
    effects.push(e);
    if (effects.length === MAX_EFFECTS) break;
  }
  // An effect whose focus is gone has ended with it.
  const focuses = new Set(effects.filter((e) => e.kind === "focus").map((e) => e.id));
  return { effects: effects.filter((e) => e.endsWith === null || focuses.has(e.endsWith)) };
};
