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

export type Entry = {
  // An item id, or GM_ENTRY for the built-in GM / Monsters row.
  id: string;
  roll: number | null;
  note: string;
  // Never true for the GM row.
  dead: boolean;
  // Acts in the GM / Monsters turn. Never the GM row; roll always null.
  monster: boolean;
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
};

export const emptyTracker = (): Tracker => ({
  entries: [newEntry(GM_ENTRY, false)],
  phase: "crawl",
  current: null,
  round: 0,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// A whole number in [min, max] from untrusted data, else null.
const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

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
  };
  // A turn only exists inside a round, and only for a living entry.
  const current = typeof raw.current === "string" && entries.some((e) => e.id === raw.current && !e.dead) ? raw.current : null;
  return current && t.round > 0 ? { ...t, current } : t;
};

// The one place the entry rules live (parse and every edit go through it):
// the GM row is never dead or a monster; a monster has no roll.
const normalized = (e: Entry): Entry => {
  const gm = e.id === GM_ENTRY;
  const monster = e.monster && !gm;
  return { ...e, dead: e.dead && !gm, monster, roll: monster ? null : e.roll };
};

const sameEntry = (a: Entry, b: Entry) =>
  a.roll === b.roll &&
  a.note === b.note &&
  a.dead === b.dead &&
  a.monster === b.monster;

const newEntry = (id: string, monster: boolean): Entry => ({ id, roll: null, note: "", dead: false, monster });

// Players and the GM row first, then the monsters, each keeping its order.
const grouped = (entries: Entry[]): Entry[] => [...entries.filter((e) => !e.monster), ...entries.filter((e) => e.monster)];

const parseCount = (raw: unknown): number => Math.min(intIn(raw, 0, Infinity) ?? 0, 9999);

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
export const next = (t: Tracker): Tracker => {
  const order = turnOrder(t);
  const i = t.current === null ? -1 : order.findIndex((e) => e.id === t.current);
  if (i === -1 || i === order.length - 1) return { ...t, round: t.round + 1, current: order[0].id };
  return { ...t, current: order[i + 1].id };
};

// ◀: back one turn, across rounds, but not before this phase's first turn.
export const previous = (t: Tracker): Tracker => {
  if (t.current === null) return t;
  const order = turnOrder(t);
  const i = order.findIndex((e) => e.id === t.current);
  if (i > 0) return { ...t, current: order[i - 1].id };
  if (t.round <= 1) return t;
  return { ...t, round: t.round - 1, current: order[order.length - 1].id };
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
export const resetRounds = (t: Tracker): Tracker =>
  t.round === 0 && t.current === null ? t : { ...t, current: null, round: 0 };

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

// Players and allies <-> monsters. The entry moves to the end of its new group
// (a new monster acts last in the GM turn) and loses its roll if it becomes
// a monster.
export const setMonster = (t: Tracker, id: string, monster: boolean): Tracker => {
  const entry = t.entries.find((e) => e.id === id);
  if (!entry || entry.id === GM_ENTRY || entry.monster === monster) return t;
  return withEntries(t, grouped([...t.entries.filter((e) => e.id !== id), normalized({ ...entry, monster })]));
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

export const setNote = (t: Tracker, id: string, note: string): Tracker =>
  edit(t, id, { note: note.slice(0, NOTE_MAX) });

// Dead entries keep their seat but get no turns; killing the current entry
// passes the turn on. The GM row can't die.
export const setDead = (t: Tracker, id: string, dead: boolean): Tracker => {
  const entries = update(t, id, { dead });
  return entries ? withEntries(t, entries) : t;
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
export const removeMonsters = (t: Tracker): Tracker =>
  remove(t, t.entries.filter((e) => e.monster).map((e) => e.id));

// The right-click "Add / Remove Initiative": if every clicked token is
// already tracked, remove them; otherwise add the ones that aren't.
export const toggle = (t: Tracker, ids: string[]): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  return ids.length > 0 && ids.every((id) => have.has(id)) ? remove(t, ids) : add(t, ids);
};
