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
  crawlRoundStarted,
  crawlRoundUndone,
  due,
  emptyCrawl,
  parseCrawl,
  resetCrawlRounds,
  clockAfterCombat,
  rollCheck,
  rollClock,
  rollDie,
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
};

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
};

export const emptyTracker = (): Tracker => ({
  entries: [newEntry(GM_ENTRY, false)],
  phase: "crawl",
  current: null,
  round: 0,
  crawl: emptyCrawl(),
  gmMod: 0,
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
  };
  // A turn only exists inside a round, and only for an entry that takes
  // turns now (living; monsters only in combat).
  const current = t.round > 0 && typeof raw.current === "string" ? turnFor(t, raw.current) : null;
  return current ? { ...t, current } : t;
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
  return { ...e, dead: e.dead && !gm, monster, roll: monster ? null : e.roll, marker: e.marker && !gm };
};

const sameEntry = (a: Entry, b: Entry) =>
  a.roll === b.roll &&
  a.note === b.note &&
  a.dead === b.dead &&
  a.monster === b.monster &&
  a.marker === b.marker;

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

// The order turns are taken in: living entries only (never empty, the GM row
// can't die).
export const turnOrder = (t: Tracker): Entry[] => {
  const living = t.entries.filter((e) => !e.dead);
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

// The GM's Crawl button: back from a fight, the Crawling Clock starts fresh.
export const backToCrawl = (t: Tracker, mode: EncounterMode): Tracker => {
  if (t.phase === "crawl") return t;
  const crawled = toCrawl(t);
  return mode === "clock" ? { ...crawled, crawl: clockAfterCombat(crawled.crawl) } : crawled;
};

// The GM's "roll automatically" setting: ▶ onto the GM / Monsters turn in a
// crawl round with a roll due rolls it (the check or the crawling die), in
// the same write as the turn. Undo still works.
export const nextWithAutoRoll = (t: Tracker, mode: EncounterMode, rand: Rand): Tracker => {
  const moved = next(t);
  if (moved.phase !== "crawl" || moved.current !== GM_ENTRY || !due(moved.crawl, mode)) return moved;
  return { ...moved, crawl: mode === "clock" ? rollClock(moved.crawl, rand) : rollCheck(moved.crawl, rand) };
};

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
  const updated = { ...t, entries };
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

// Monsters have no roll of their own (normalized drops it).
export const setRoll = (t: Tracker, id: string, roll: number | null): Tracker =>
  edit(t, id, { roll: parseRoll(roll) });

// The monsters' DEX modifier for the GM's initiative roll.
export const setGmMod = (t: Tracker, mod: number): Tracker => {
  const gmMod = Math.max(MOD_MIN, Math.min(MOD_MAX, Math.trunc(mod)));
  return gmMod === t.gmMod ? t : { ...t, gmMod };
};

// The GM / Monsters initiative: a d20 plus the monsters' modifier (p. 83, 88),
// saved as the GM row's roll.
export const rollGmInitiative = (t: Tracker, rand: Rand): Tracker => setRoll(t, GM_ENTRY, rollDie(20, rand) + t.gmMod);

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
