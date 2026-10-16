// The initiative tracker: one document per scene, written only by the GM.
// Pure functions only (no SDK, no React) so every rule here is unit-tested.
//
// `entries` is in list order. What that order means depends on the mode:
// - d20: the list IS the turn order (the GM sorts it by roll).
// - table: the list is the seating around the table, clockwise. The highest
//   roll takes the first turn, then turns go round the seating from there.
//
// Dead entries stay in the list (so the seating holds) but get no turns.

export const GM_ENTRY = "gm";
export const MAX_ENTRIES = 40;
export const NOTE_MAX = 200;
export const ROLL_MIN = -99;
export const ROLL_MAX = 99;

export type OrderMode = "d20" | "table";

export type Entry = {
  // An item id, or GM_ENTRY for the built-in GM / Monsters row.
  id: string;
  roll: number | null;
  note: string;
  // Never true for the GM row.
  dead: boolean;
};

export type Tracker = {
  entries: Entry[];
  // Id of the entry whose turn it is; null until the GM starts.
  current: string | null;
  // 0 until the GM starts.
  round: number;
};

export const emptyTracker = (): Tracker => ({
  entries: [{ id: GM_ENTRY, roll: null, note: "", dead: false }],
  current: null,
  round: 0,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const parseRoll = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= ROLL_MIN && raw <= ROLL_MAX ? raw : null;

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
    entries.push({
      id: e.id,
      roll: parseRoll(e.roll),
      note: typeof e.note === "string" ? e.note.slice(0, NOTE_MAX) : "",
      dead: e.dead === true && e.id !== GM_ENTRY,
    });
    if (entries.length === MAX_ENTRIES) break;
  }
  if (!seen.has(GM_ENTRY)) {
    if (entries.length === MAX_ENTRIES) entries.pop();
    entries.push({ id: GM_ENTRY, roll: null, note: "", dead: false });
  }
  const round = typeof raw.round === "number" && Number.isInteger(raw.round) && raw.round >= 0 ? Math.min(raw.round, 9999) : 0;
  const current = typeof raw.current === "string" && entries.some((e) => e.id === raw.current && !e.dead) ? raw.current : null;
  return { entries, current: current && round > 0 ? current : null, round: current ? Math.max(round, 1) : 0 };
};

// Entries whose token no longer exists drop out (the GM row always stays).
// Returns the same object when nothing changed.
export const prune = (t: Tracker, exists: (id: string) => boolean, mode: OrderMode): Tracker => {
  const entries = t.entries.filter((e) => e.id === GM_ENTRY || exists(e.id));
  if (entries.length === t.entries.length) return t;
  return withEntries(t, entries, mode);
};

// The order turns are taken in: living entries only (never empty, the GM row
// can't die).
export const turnOrder = (t: Tracker, mode: OrderMode): Entry[] => {
  const living = t.entries.filter((e) => !e.dead);
  if (mode === "d20" || living.length === 0) return living;
  // First highest roll in seating order starts; no rolls at all = seat one.
  let start = 0;
  living.forEach((e, i) => {
    const best = living[start].roll;
    if (e.roll !== null && (best === null || e.roll > best)) start = i;
  });
  return [...living.slice(start), ...living.slice(0, start)];
};

export const start = (t: Tracker, mode: OrderMode): Tracker => ({
  ...t,
  current: turnOrder(t, mode)[0]?.id ?? null,
  round: 1,
});

export const stop = (t: Tracker): Tracker => ({ ...t, current: null, round: 0 });

export const next = (t: Tracker, mode: OrderMode): Tracker => {
  if (t.current === null) return start(t, mode);
  const order = turnOrder(t, mode);
  const i = order.findIndex((e) => e.id === t.current);
  if (i === order.length - 1) return { ...t, current: order[0].id, round: t.round + 1 };
  return { ...t, current: order[i + 1].id };
};

export const previous = (t: Tracker, mode: OrderMode): Tracker => {
  if (t.current === null) return t;
  const order = turnOrder(t, mode);
  const i = order.findIndex((e) => e.id === t.current);
  if (i > 0) return { ...t, current: order[i - 1].id };
  // Back past the first turn of round 1: nothing to go back to.
  if (t.round <= 1) return t;
  return { ...t, current: order[order.length - 1].id, round: t.round - 1 };
};

// Highest roll first; no roll goes last; ties keep their current order.
export const sortByRoll = (t: Tracker): Tracker => {
  const sorted = [...t.entries].sort((a, b) => (b.roll ?? -Infinity) - (a.roll ?? -Infinity));
  return sorted.every((e, i) => e === t.entries[i]) ? t : { ...t, entries: sorted };
};

// Adds the ids not already tracked, in the given order, up to the cap.
export const add = (t: Tracker, ids: string[]): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  const fresh = ids.filter((id, i) => id !== GM_ENTRY && !have.has(id) && ids.indexOf(id) === i);
  const room = MAX_ENTRIES - t.entries.length;
  if (fresh.length === 0 || room <= 0) return t;
  return {
    ...t,
    entries: [...t.entries, ...fresh.slice(0, room).map((id) => ({ id, roll: null, note: "", dead: false }))],
  };
};

export const remove = (t: Tracker, ids: string[], mode: OrderMode): Tracker => {
  const gone = new Set(ids.filter((id) => id !== GM_ENTRY));
  const entries = t.entries.filter((e) => !gone.has(e.id));
  if (entries.length === t.entries.length) return t;
  return withEntries(t, entries, mode);
};

// New entry list. If the current entry left the list or died, the turn
// passes to whoever would have been next (in the old order) and still gets
// turns.
const withEntries = (t: Tracker, entries: Entry[], mode: OrderMode): Tracker => {
  const updated = { ...t, entries };
  const turns = new Set(turnOrder(updated, mode).map((e) => e.id));
  if (t.current === null || turns.has(t.current)) return updated;
  const order = turnOrder(t, mode);
  const i = order.findIndex((e) => e.id === t.current);
  const after = [...order.slice(i + 1), ...order.slice(0, i)].find((e) => turns.has(e.id));
  return { ...updated, current: after?.id ?? null, round: after ? t.round : 0 };
};

// The entry list with one entry changed, or null if nothing changed.
const update = (t: Tracker, id: string, change: Partial<Entry>): Entry[] | null => {
  const i = t.entries.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const old = t.entries[i];
  const entry = { ...old, ...change };
  if (entry.roll === old.roll && entry.note === old.note && entry.dead === old.dead) return null;
  const entries = [...t.entries];
  entries[i] = entry;
  return entries;
};

const edit = (t: Tracker, id: string, change: Partial<Entry>): Tracker => {
  const entries = update(t, id, change);
  return entries ? { ...t, entries } : t;
};

export const setRoll = (t: Tracker, id: string, roll: number | null): Tracker =>
  edit(t, id, { roll: parseRoll(roll) });

export const setNote = (t: Tracker, id: string, note: string): Tracker =>
  edit(t, id, { note: note.slice(0, NOTE_MAX) });

// Dead entries keep their seat but get no turns; killing the current entry
// passes the turn on. The GM row can't die.
export const setDead = (t: Tracker, id: string, dead: boolean, mode: OrderMode): Tracker => {
  const entries = id === GM_ENTRY ? null : update(t, id, { dead });
  return entries ? withEntries(t, entries, mode) : t;
};

// Move an entry one place up (-1) or down (+1) in the list.
export const move = (t: Tracker, id: string, by: -1 | 1): Tracker => {
  const i = t.entries.findIndex((e) => e.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= t.entries.length) return t;
  const entries = [...t.entries];
  [entries[i], entries[j]] = [entries[j], entries[i]];
  return { ...t, entries };
};

// The right-click "Add / Remove Initiative": if every clicked token is
// already tracked, remove them; otherwise add the ones that aren't.
export const toggle = (t: Tracker, ids: string[], mode: OrderMode): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  return ids.length > 0 && ids.every((id) => have.has(id)) ? remove(t, ids, mode) : add(t, ids);
};
