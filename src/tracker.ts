// The initiative tracker: one document per scene, written only by the GM.
// Pure functions only (no SDK, no React) so every rule here is unit-tested.
//
// `entries` holds the players' rows and the GM / Monsters row in turn order
// (the GM sorts them by roll or drags them), then the monsters. Monsters act
// on the GM / Monsters roll (core pp. 82, 88: one roll, the monsters' best
// DEX): no rolls of their own. In combat their turns come right after that
// row, one each, in their list order; while crawling the GM turn covers them.
// Dead entries stay listed but get no turns.
//
import {
  checkMade,
  crawlRoundStarted,
  crawlRoundUndone,
  due,
  emptyCrawl,
  parseCrawl,
  resetCrawlRounds,
  rollDie,
  rollFor,
  type Crawl,
  type EncounterMode,
  type Rand,
} from "./crawl";
import { intIn, isObject, parseCount } from "./parse";

// Shadowdark is always in turn order (core p. 82). The tracker is in one of
// two phases: crawl or combat. A round is a round (p. 82: "a round completes
// when each person has taken one turn"), so one count runs through both;
// only encounter checks care which kind it was (crawl only, p. 112).
// Switching phase ends the current round: the next ▶ starts a new one.

export const GM_ENTRY = "gm";
export const MAX_ENTRIES = 40;
export const NOTE_MAX = 200;
export const ROLL_MIN = -99;
export const ROLL_MAX = 99;
// The monsters' initiative modifier: the highest DEX modifier among them.
export const MOD_MIN = -9;
export const MOD_MAX = 9;
export const HP_MAX = 999;

export type Entry = {
  // An item id, or GM_ENTRY for the built-in GM / Monsters row.
  id: string;
  roll: number | null;
  note: string;
  // Never true for the GM row.
  dead: boolean;
  // Acts in the GM / Monsters turn. Never the GM row; roll always null.
  monster: boolean;
  // Gets the turn marker on its turn. Starts on for players and allies, off
  // for monsters; the GM changes it per token. Never the GM row.
  marker: boolean;
  // A monster's hit points, GM only (the panel shows them to the GM).
  // Undefined: not tracked (and absent from the saved doc, which keeps the
  // list small). Monsters only; 0 <= cur <= max.
  hp?: Hp;
};

export type Hp = { cur: number; max: number };

export type Phase = "crawl" | "combat";

export type Tracker = {
  entries: Entry[];
  phase: Phase;
  // Id of the entry whose turn it is; null between rounds (before the first
  // ▶, and after a phase switch).
  current: string | null;
  // Rounds so far, crawl and combat alike (0 before the first).
  round: number;
  // This map's encounter checks / Crawling Clock (crawl.ts).
  crawl: Crawl;
  // What the GM adds to the GM / Monsters initiative d20 (p. 83: the highest
  // DEX modifier of any monsters).
  gmMod: number;
  // The GM's last initiative roll, for the equation under the GM row
  // (`d20 12 + 2`). Shown only while it still adds up to that row's roll (a
  // typed roll replaces it).
  gmDie: GmDie | null;
  // The Party token: one tracked player entry standing for the whole party
  // while exploring. Null when the map has none.
  party: string | null;
  // The party travels together: the Party token takes turns and the players'
  // rows sit out. Off (split): the players take turns and the Party token
  // sits out. Always off with no Party token.
  together: boolean;
  // The player who carried the party's light the last time it split, so the
  // next split offers them first. A tracked player entry, else null.
  carrier: string | null;
  // While together, each player's token is attached to the Party token so it
  // travels with it (Owlbear's attach, position only). What it was attached to
  // before (a mount, say), to put back on Split. Tracked player entries only.
  prior: Record<string, PriorAttach>;
};

// A token's own attachment before the party took it: its parent and the
// behaviours it had switched off (null: none).
export type PriorAttach = { to: string | null; off: string[] | null };

export type Point = { x: number; y: number };

export type GmDie = { die: number; mod: number };

export const emptyTracker = (): Tracker => ({
  entries: [newEntry(GM_ENTRY, false)],
  phase: "crawl",
  current: null,
  round: 0,
  crawl: emptyCrawl(),
  gmMod: 0,
  gmDie: null,
  party: null,
  together: false,
  carrier: null,
  prior: {},
});


export const parseRoll = (raw: unknown): number | null => intIn(raw, ROLL_MIN, ROLL_MAX);

// Scene metadata is untrusted (any client or extension can write it). Keep
// only well-formed entries, drop duplicates, cap everything, and always keep
// exactly one GM row.
export const parseTracker = (raw: unknown): Tracker => {
  if (!isObject(raw)) return emptyTracker();
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const e of Array.isArray(raw.entries) ? raw.entries : []) {
    if (!isObject(e) || typeof e.id !== "string" || e.id === "" || e.id.length > 64 || seen.has(e.id)) continue;
    seen.add(e.id);
    entries.push(
      normalized({
        id: e.id,
        roll: parseRoll(e.roll),
        note: typeof e.note === "string" ? e.note.slice(0, NOTE_MAX) : "",
        dead: e.dead === true,
        monster: e.monster === true,
        marker: typeof e.marker === "boolean" ? e.marker : e.monster !== true,
        hp: parseHp(e.hp),
      }),
    );
    if (entries.length === MAX_ENTRIES) break;
  }
  if (!seen.has(GM_ENTRY)) {
    if (entries.length === MAX_ENTRIES) entries.pop();
    entries.push(newEntry(GM_ENTRY, false));
  }
  const phase: Phase = raw.phase === "combat" ? "combat" : "crawl";
  const t: Tracker = {
    entries: grouped(entries),
    phase,
    current: null,
    round: parseCount(raw.round),
    crawl: parseCrawl(raw.crawl),
    gmMod: intIn(raw.gmMod, MOD_MIN, MOD_MAX) ?? 0,
    gmDie: parseGmDie(raw.gmDie),
    party: null,
    together: false,
    carrier: null,
    prior: {},
  };
  const party =
    typeof raw.party === "string" && entries.some((e) => e.id === raw.party && e.id !== GM_ENTRY && !e.monster) ? raw.party : null;
  const carrier =
    party !== null && typeof raw.carrier === "string" && entries.some((e) => e.id === raw.carrier && e.id !== GM_ENTRY && e.id !== party && !e.monster)
      ? raw.carrier
      : null;
  const together = party !== null && raw.together === true;
  const parsed: Tracker = { ...t, party, together, carrier, prior: party === null ? {} : parsePrior(raw.prior, entries, party) };
  // A turn only exists inside a round, and only for an entry that takes
  // turns now (living, in the party's mode; monsters only in combat).
  const current = parsed.round > 0 && typeof raw.current === "string" ? turnFor(parsed, raw.current) : null;
  return current ? { ...parsed, current } : parsed;
};

const BEHAVIOURS = ["VISIBLE", "SCALE", "ROTATION", "POSITION", "DELETE", "LOCKED", "COPY"];
// Untrusted: tracked player entries only; an id-sized parent; known behaviours.
const parsePrior = (raw: unknown, entries: Entry[], party: string): Record<string, PriorAttach> => {
  const out: Record<string, PriorAttach> = {};
  if (!isObject(raw)) return out;
  for (const e of entries) {
    const v = raw[e.id];
    if (e.monster || e.id === GM_ENTRY || e.id === party || !isObject(v)) continue;
    const to = typeof v.to === "string" && v.to !== "" && v.to.length <= 64 && v.to !== party ? v.to : null;
    const off = Array.isArray(v.off) ? v.off.filter((b): b is string => typeof b === "string" && BEHAVIOURS.includes(b)) : null;
    out[e.id] = { to, off };
  }
  return out;
};

// Untrusted: whole numbers, 1 <= max <= HP_MAX, 0 <= cur <= max.
const parseHp = (raw: unknown): Hp | undefined => {
  if (!isObject(raw)) return undefined;
  const max = intIn(raw.max, 1, HP_MAX);
  const cur = intIn(raw.cur, 0, HP_MAX);
  return max === null || cur === null ? undefined : { cur: Math.min(cur, max), max };
};

const parseGmDie = (raw: unknown): GmDie | null => {
  if (!isObject(raw)) return null;
  const die = intIn(raw.die, 1, 20);
  const mod = intIn(raw.mod, MOD_MIN, MOD_MAX);
  return die === null || mod === null ? null : { die, mod };
};

// Who has the turn a saved `id` held, if `id` doesn't take turns now: the GM
// row covers a monster while crawling, and a dead entry's turn passes to the
// next living one (as marking the current entry dead does). Dropping the turn
// instead would make the next ▶ start a new round early.
const turnFor = (t: Tracker, id: string): string | null => {
  const turns = turnOrder(t).map((e) => e.id);
  if (turns.includes(id)) return id;
  const entry = t.entries.find((e) => e.id === id);
  if (!entry) return null;
  if (entry.monster && t.phase === "crawl") return GM_ENTRY;
  const all = turnOrder({ ...t, entries: t.entries.map((e) => (e.id === id ? { ...e, dead: false } : e)) }).map((e) => e.id);
  const i = all.indexOf(id);
  return [...all.slice(i + 1), ...all.slice(0, i)].find((other) => turns.includes(other)) ?? null;
};

// The one place the entry rules live (parse and every edit go through it):
// the GM row is never dead or a monster; a monster has no roll.
const normalized = (e: Entry): Entry => {
  const gm = e.id === GM_ENTRY;
  const monster = e.monster && !gm;
  return { ...e, dead: e.dead && !gm, monster, roll: monster ? null : e.roll, marker: e.marker && !gm, hp: monster ? e.hp : undefined };
};

const sameEntry = (a: Entry, b: Entry) =>
  a.roll === b.roll &&
  a.note === b.note &&
  a.dead === b.dead &&
  a.monster === b.monster &&
  a.marker === b.marker &&
  a.hp?.cur === b.hp?.cur &&
  a.hp?.max === b.hp?.max;

const newEntry = (id: string, monster: boolean): Entry =>
  normalized({ id, roll: null, note: "", dead: false, monster, marker: !monster });

// Players and the GM row first, then the monsters, each keeping its order.
const grouped = (entries: Entry[]): Entry[] => [...entries.filter((e) => !e.monster), ...entries.filter((e) => e.monster)];

// Entries whose token no longer exists drop out (the GM row always stays).
// Returns the same object when nothing changed.
export const prune = (t: Tracker, exists: (id: string) => boolean): Tracker => {
  const entries = t.entries.filter((e) => e.id === GM_ENTRY || exists(e.id));
  if (entries.length === t.entries.length) return t;
  return withEntries(t, entries);
};

// With a Party token the players split into two sets and one sits out: the
// Party token while split, the players while together. Everyone else (the GM
// row, monsters) always takes part; with no Party token, so does everyone.
export const inTurns = (t: Tracker, e: Entry): boolean =>
  t.party === null || e.monster || e.id === GM_ENTRY || (e.id === t.party) === t.together;

// The order turns are taken in: living entries only (never empty, the GM row
// can't die).
export const turnOrder = (t: Tracker): Entry[] => {
  const living = t.entries.filter((e) => !e.dead && inTurns(t, e));
  const monsters = t.phase === "combat" ? living.filter((e) => e.monster) : [];
  return living.filter((e) => !e.monster).flatMap((e) => (e.id === GM_ENTRY ? [e, ...monsters] : [e]));
};

// ▶: the next living entry's turn. Between rounds, or after the last turn,
// a new round of the current phase starts at the top.
// A new crawl round counts toward encounter checks; a combat round doesn't.
export const next = (t: Tracker): Tracker => {
  const order = turnOrder(t);
  const i = t.current === null ? -1 : order.findIndex((e) => e.id === t.current);
  if (i !== -1 && i !== order.length - 1) return { ...t, current: order[i + 1].id };
  const crawl = t.phase === "crawl" ? crawlRoundStarted(t.crawl) : t.crawl;
  return { ...t, round: t.round + 1, current: order[0].id, crawl };
};

// ◀: back one turn, across rounds, but not before round 1.
export const previous = (t: Tracker): Tracker => {
  if (t.current === null) return t;
  const order = turnOrder(t);
  const i = order.findIndex((e) => e.id === t.current);
  if (i > 0) return { ...t, current: order[i - 1].id };
  if (t.round <= 1) return t;
  const crawl = t.phase === "crawl" ? crawlRoundUndone(t.crawl) : t.crawl;
  return { ...t, round: t.round - 1, current: order[order.length - 1].id, crawl };
};

// The GM's "roll automatically" setting: ▶ onto the GM / Monsters turn in a
// crawl round with a roll due rolls it (the check or the crawling die), in
// the same write as the turn. Undo still works. `start` is the clock's size.
export const nextWithAutoRoll = (t: Tracker, mode: EncounterMode, rand: Rand, start?: number, dark = false): Tracker => {
  const moved = next(t);
  if (mode === "manual" || moved.phase !== "crawl" || moved.current !== GM_ENTRY || !due(moved.crawl, mode, dark)) return moved;
  return { ...moved, crawl: rollFor(mode, start, dark)(moved.crawl, rand) };
};

// Encounter rolls off: the GM rolls at the table, so ▶ off the GM / Monsters
// turn in a crawl round counts a due check as made (◀ back keeps it made).
export const nextAfterManualCheck = (t: Tracker, dark = false, every?: number): Tracker =>
  next(t.phase === "crawl" && t.current === GM_ENTRY ? updateCrawl(t, (c) => checkMade(c, dark, every)) : t);

// A change to this map's crawl (crawl.ts); the same object when nothing changed.
export const updateCrawl = (t: Tracker, fn: (c: Crawl) => Crawl): Tracker => {
  const crawl = fn(t.crawl);
  return crawl === t.crawl ? t : { ...t, crawl };
};

// Combat starts with the next round (the count carries on).
// With clearRolls (the book's "new initiative", p. 88) every roll is cleared
// for the combat roll. The book has no rule for going back to the crawl
// order, so the combat order simply carries on into the crawl.
export const toCombat = (t: Tracker, clearRolls: boolean): Tracker => {
  if (t.phase === "combat") return t;
  return {
    ...t,
    phase: "combat",
    current: null,
    entries: clearRolls ? t.entries.map((e) => (e.roll === null ? e : { ...e, roll: null })) : t.entries,
    gmDie: clearRolls ? null : t.gmDie,
  };
};

// The round count back to 0 and no one's turn; order, rolls and phase stay.
export const resetRounds = (t: Tracker): Tracker => {
  const crawl = resetCrawlRounds(t.crawl);
  return t.round === 0 && t.current === null && crawl === t.crawl ? t : { ...t, current: null, round: 0, crawl };
};

// What a player sees: hidden tokens drop out, and on a hidden token's turn
// the GM row shows as current.
export const playerView = (t: Tracker, visible: (id: string) => boolean) => {
  const entries = t.entries.filter((e) => e.id === GM_ENTRY || visible(e.id));
  const current = t.current !== null && !entries.some((e) => e.id === t.current) ? GM_ENTRY : t.current;
  return { entries, current };
};

// Back to crawling, keeping the combat order and rolls.
export const toCrawl = (t: Tracker): Tracker =>
  t.phase === "crawl" ? t : { ...t, phase: "crawl", current: null };

// Highest roll first; no roll goes last; ties keep their current order.
// Monsters (no rolls) keep their own order. The stable sort already leaves
// them last; grouped() keeps the players-then-monsters layout explicit.
export const sortByRoll = (t: Tracker): Tracker => {
  const sorted = grouped([...t.entries].sort((a, b) => (b.roll ?? -Infinity) - (a.roll ?? -Infinity)));
  return sorted.every((e, i) => e === t.entries[i]) ? t : { ...t, entries: sorted };
};

// Adds the ids not already tracked, in the given order, up to the cap, as
// players (the GM marks monsters in the tracker).
export const add = (t: Tracker, ids: string[]): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  const fresh = ids.filter((id, i) => id !== GM_ENTRY && !have.has(id) && ids.indexOf(id) === i);
  const room = MAX_ENTRIES - t.entries.length;
  if (fresh.length === 0 || room <= 0) return t;
  return withEntries(t, grouped([...t.entries, ...fresh.slice(0, room).map((id) => newEntry(id, false))]));
};

// Players and allies <-> monsters, one or many (the GM's batch selection).
// Switched entries move to the end of their new group in their current order
// (new monsters act last in the GM turn), lose their roll if they become
// monsters, and take the new kind's turn-marker default.
export const setMonster = (t: Tracker, ids: string[], monster: boolean): Tracker => {
  const switching = new Set(ids.filter((id) => t.entries.some((e) => e.id === id && e.id !== GM_ENTRY && e.monster !== monster)));
  if (switching.size === 0) return t;
  const switched = t.entries.filter((e) => switching.has(e.id)).map((e) => normalized({ ...e, monster, marker: !monster }));
  return withEntries(t, grouped([...t.entries.filter((e) => !switching.has(e.id)), ...switched]));
};

export const remove = (t: Tracker, ids: string[]): Tracker => {
  const gone = new Set(ids.filter((id) => id !== GM_ENTRY));
  const entries = t.entries.filter((e) => !gone.has(e.id));
  if (entries.length === t.entries.length) return t;
  return withEntries(t, entries);
};

// New entry list. If the current entry left the list or died, the turn
// passes to whoever would have been next (in the old order) and still gets
// turns.
const withEntries = (t: Tracker, entries: Entry[]): Tracker => {
  const party = t.party !== null && entries.some((e) => e.id === t.party && !e.monster) ? t.party : null;
  const carrier = t.carrier !== null && party !== null && entries.some((e) => e.id === t.carrier && !e.monster) ? t.carrier : null;
  const prior = party === null ? {} : Object.fromEntries(Object.entries(t.prior).filter(([id]) => entries.some((e) => e.id === id && !e.monster)));
  const updated = { ...t, entries, party, together: party !== null && t.together, carrier, prior };
  const turns = new Set(turnOrder(updated).map((e) => e.id));
  if (t.current === null || turns.has(t.current)) return updated;
  const order = turnOrder(t);
  const i = order.findIndex((e) => e.id === t.current);
  const after = [...order.slice(i + 1), ...order.slice(0, i)].find((e) => turns.has(e.id));
  return { ...updated, current: after?.id ?? null };
};

// The entry list with one entry changed, or null if nothing changed.
const update = (t: Tracker, id: string, change: Partial<Entry>): Entry[] | null => {
  const i = t.entries.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const old = t.entries[i];
  const entry = normalized({ ...old, ...change });
  if (sameEntry(entry, old)) return null;
  const entries = [...t.entries];
  entries[i] = entry;
  return entries;
};

const edit = (t: Tracker, id: string, change: Partial<Entry>): Tracker => {
  const entries = update(t, id, change);
  return entries ? { ...t, entries } : t;
};

// Monsters have no roll of their own (normalized drops it). A roll typed
// into the GM row drops its equation (a later roll of the same sum mustn't
// bring an old die back).
export const setRoll = (t: Tracker, id: string, roll: number | null): Tracker => {
  const updated = edit(t, id, { roll: parseRoll(roll) });
  return id === GM_ENTRY && updated !== t && updated.gmDie ? { ...updated, gmDie: null } : updated;
};

// A roll typed or rolled: the list sorts itself by roll (Matt, 2026-11-06).
// Clearing a roll leaves the order alone.
export const enterRoll = (t: Tracker, id: string, roll: number | null): Tracker => {
  const updated = setRoll(t, id, roll);
  return roll === null || updated === t ? updated : sortByRoll(updated);
};

// The monsters' DEX modifier for the GM's initiative roll.
export const setGmMod = (t: Tracker, mod: number): Tracker => {
  const gmMod = Math.max(MOD_MIN, Math.min(MOD_MAX, Math.trunc(mod)));
  return gmMod === t.gmMod ? t : { ...t, gmMod };
};

// The GM / Monsters initiative: a d20 plus the monsters' modifier (p. 83, 88),
// saved as the GM row's roll, with the die kept for the equation.
export const rollGmInitiative = (t: Tracker, rand: Rand): Tracker => {
  const die = rollDie(20, rand);
  return { ...setRoll(t, GM_ENTRY, die + t.gmMod), gmDie: { die, mod: t.gmMod } };
};

// The GM row's equation, if its roll is still the last d20 rolled for it.
export const gmEquation = (t: Tracker): GmDie | null => {
  const roll = t.entries.find((e) => e.id === GM_ENTRY)?.roll;
  return t.gmDie && roll === t.gmDie.die + t.gmDie.mod ? t.gmDie : null;
};

export const setNote = (t: Tracker, id: string, note: string): Tracker =>
  edit(t, id, { note: note.slice(0, NOTE_MAX) });

// The same change on several entries; null if none changed.
const updateMany = (t: Tracker, ids: string[], change: Partial<Entry>): Entry[] | null => {
  let entries: Entry[] | null = null;
  for (const id of ids) entries = update(entries ? { ...t, entries } : t, id, change) ?? entries;
  return entries;
};

// Dead entries keep their seat but get no turns; killing the current entry
// passes the turn on. The GM row can't die.
export const setDead = (t: Tracker, ids: string[], dead: boolean): Tracker => {
  const entries = updateMany(t, ids, { dead });
  return entries ? withEntries(t, entries) : t;
};

// What the GM typed in an HP box, applied to a monster's hit points. Returns
// the new value (null: cleared), or undefined when the text isn't one (the
// box then puts the old text back).
//   12      no HP yet: 12/12. With HP: current becomes 12 (up to the max).
//   -3 +4   take 3 / heal 4 (needs HP; a no-op without)
//   /12     the max becomes 12 (current stays, or starts full with no HP)
//   5/12    current 5 of 12
//   empty   stop tracking
export const applyHpText = (hp: Hp | undefined, text: string): Hp | null | undefined => {
  const t = text.trim().replace(/[−–]/g, "-");
  if (t === "") return null;
  const num = (s: string, lo: number) => (/^\d{1,3}$/.test(s) && Number(s) >= lo && Number(s) <= HP_MAX ? Number(s) : undefined);
  let m = /^([+-])(\d{1,3})$/.exec(t);
  if (m) {
    if (!hp) return undefined;
    const by = Number(m[2]) * (m[1] === "-" ? -1 : 1);
    return { ...hp, cur: Math.max(0, Math.min(hp.max, hp.cur + by)) };
  }
  m = /^(\d{1,3})?\/(\d{1,3})$/.exec(t);
  if (m) {
    const max = num(m[2], 1);
    const cur = m[1] === undefined ? undefined : num(m[1], 0);
    if (max === undefined || (m[1] !== undefined && cur === undefined)) return undefined;
    return { cur: Math.min(cur ?? hp?.cur ?? max, max), max };
  }
  const n = num(t, 0);
  if (n === undefined) return undefined;
  if (!hp) return n >= 1 ? { cur: n, max: n } : undefined;
  return { ...hp, cur: Math.min(n, hp.max) };
};

// The same typed text on several monsters (one box on a stack's line): each
// applies it to its own hit points. Dead monsters are left as they are.
export const setHp = (t: Tracker, ids: string[], text: string): Tracker => {
  let entries: Entry[] | null = null;
  for (const id of ids) {
    const e = (entries ?? t.entries).find((x) => x.id === id);
    if (!e || !e.monster || e.dead) continue;
    const hp = applyHpText(e.hp, text);
    if (hp === undefined) continue;
    entries = update(entries ? { ...t, entries } : t, id, { hp: hp ?? undefined }) ?? entries;
  }
  return entries ? { ...t, entries } : t;
};

// A monster marked just now starts with the HP of a tracked monster that is
// the same kind (`kind` names it: stacks.ts), at full health. Others keep what they have.
export const inheritHp = (t: Tracker, ids: string[], kind: (id: string) => string): Tracker => {
  let entries: Entry[] | null = null;
  for (const id of ids) {
    const list: Entry[] = entries ?? t.entries;
    const e = list.find((x) => x.id === id);
    if (!e || !e.monster || e.hp) continue;
    const k = kind(id);
    const twin: Entry | undefined = list.find((x) => x.id !== id && x.monster && x.hp && kind(x.id) === k);
    if (twin?.hp) entries = update(entries ? { ...t, entries } : t, id, { hp: { cur: twin.hp.max, max: twin.hp.max } }) ?? entries;
  }
  return entries ? { ...t, entries } : t;
};

// The turn marker on or off for these tokens' turns.
export const setMarker = (t: Tracker, ids: string[], marker: boolean): Tracker => {
  const entries = updateMany(t, ids, { marker });
  return entries ? { ...t, entries } : t;
};

// The GM's drag and drop: move an entry to where `overId` is. Players and
// the GM row move among themselves, monsters among monsters.
export const moveTo = (t: Tracker, id: string, overId: string): Tracker => {
  const from = t.entries.findIndex((e) => e.id === id);
  const to = t.entries.findIndex((e) => e.id === overId);
  if (from < 0 || to < 0 || from === to || t.entries[from].monster !== t.entries[to].monster) return t;
  const entries = [...t.entries];
  entries.splice(to, 0, ...entries.splice(from, 1));
  return { ...t, entries };
};

// After a fight: every monster out (the GM row stays).
// After a fight: the monsters go, and so does their initiative modifier (the
// next fight's monsters bring their own).
export const removeMonsters = (t: Tracker): Tracker =>
  setGmMod(remove(t, t.entries.filter((e) => e.monster).map((e) => e.id)), 0);

// The right-click "Add / Remove Initiative": if every clicked token is
// already tracked, remove them; otherwise add the ones that aren't.
export const toggle = (t: Tracker, ids: string[]): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  return ids.length > 0 && ids.every((id) => have.has(id)) ? remove(t, ids) : add(t, ids);
};

// The Party token (right-click "Set as party token"): a player entry that
// stands for everyone. Setting it tracks the token if it isn't yet (no room,
// a monster or the GM row: nothing changes); another token replaces it; null
// clears it. Either way the players are split afterwards and nothing is
// hidden or moved by the change itself (the switch does that).
export const setParty = (t: Tracker, id: string | null): Tracker => {
  if (id === null) return t.party === null ? t : { ...t, party: null, together: false, carrier: null, prior: {} };
  if (id === GM_ENTRY || t.party === id) return t;
  const tracked = add(t, [id]);
  const entry = tracked.entries.find((e) => e.id === id);
  if (!entry || entry.monster) return t;
  return { ...tracked, party: id, together: false, carrier: null, prior: {} };
};

// Who the Party token stands for: the living players (not monsters, not the
// GM row, not the Party token). The turns, the lights and the map all use it.
export const inParty = (t: Pick<Tracker, "party">, e: Entry) => !e.monster && e.id !== GM_ENTRY && e.id !== t.party && !e.dead;
export const partyMembers = (t: Tracker): string[] => t.entries.filter((e) => inParty(t, e)).map((e) => e.id);

// The Party / Split switch. It doesn't end the round (Matt, 2026-11-07).
// Coming together, the Party token takes the initiative of the party's
// highest roll and sits where that player sat (no rolls: it stays put); the
// turn in progress carries over: a player's turn is the Party token's. Splitting,
// the Party token's turn is the first player's (the one with the highest
// roll: the player after it in the list). `carrier`: who has the light now when splitting, kept for next time;
// coming together, who it came from.
export const setTogether = (t: Tracker, together: boolean, carrier: string | null = t.carrier): Tracker => {
  if (t.party === null || t.together === together) return t;
  const party = t.party;
  const keep = carrier !== null && carrier !== party && t.entries.some((e) => e.id === carrier && !e.monster && e.id !== GM_ENTRY) ? carrier : null;
  const isPlayer = (e: Entry) => inParty(t, e);
  let entries = t.entries;
  if (together) {
    const rolled = t.entries.filter((e) => isPlayer(e) && e.roll !== null);
    if (rolled.length > 0) {
      const top = Math.max(...rolled.map((e) => e.roll as number));
      const at = t.entries.findIndex((e) => isPlayer(e) && e.roll === top);
      const me = t.entries.find((e) => e.id === party)!;
      const rest = t.entries.filter((e) => e.id !== party);
      const place = rest.findIndex((e) => e.id === t.entries[at].id);
      entries = [...rest.slice(0, place), { ...me, roll: top }, ...rest.slice(place)];
    }
  }
  const players = entries.filter(isPlayer);
  const current = t.current === null || t.current === GM_ENTRY || entries.some((e) => e.id === t.current && e.monster)
    ? t.current
    : together
      ? (t.current === party ? party : players.some((e) => e.id === t.current) ? party : t.current)
      : t.current === party
        ? (players.find((e) => entries.indexOf(e) > entries.findIndex((x) => x.id === party))?.id ?? players[0]?.id ?? null)
        : t.current;
  return { ...t, entries, together, carrier: keep, current, prior: together ? t.prior : {} };
};

// The players' own attachments, saved as the party comes together (kept
// until it splits, then cleared).
export const setPrior = (t: Tracker, prior: Record<string, PriorAttach>): Tracker =>
  t.party === null || JSON.stringify(t.prior) === JSON.stringify(prior) ? t : { ...t, prior };
