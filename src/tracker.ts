// The initiative tracker: one document per scene, written only by the GM.
// Pure functions only (no SDK, no React) so every rule here is unit-tested.
//
// `entries` is the turn order (the GM sorts it by roll or moves rows).
// Dead entries stay in the list (so the seating holds) but get no turns.
//
// Shadowdark is always in turn order (core p. 82). The tracker is in one of
// two phases: crawl or combat. Each has its own round count; the crawl count
// pauses during combat (encounter checks run on crawl rounds only, p. 112).
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
};

export type Phase = "crawl" | "combat";

// Crawl order and rolls, kept while combat uses fresh rolls.
export type SavedRoll = [id: string, roll: number | null];

export type Tracker = {
  entries: Entry[];
  phase: Phase;
  // Id of the entry whose turn it is; null between rounds (before the first
  // ▶, and after a phase switch).
  current: string | null;
  // Crawl rounds so far (0 before the first) and rounds of this combat.
  round: number;
  combatRound: number;
  // Set when combat cleared the rolls: put back on returning to crawl.
  saved: SavedRoll[] | null;
};

export const emptyTracker = (): Tracker => ({
  entries: [{ id: GM_ENTRY, roll: null, note: "", dead: false }],
  phase: "crawl",
  current: null,
  round: 0,
  combatRound: 0,
  saved: null,
});

// The round count of the phase the tracker is in.
export const phaseRound = (t: Tracker): number => (t.phase === "combat" ? t.combatRound : t.round);

const withPhaseRound = (t: Tracker, n: number): Tracker =>
  t.phase === "combat" ? { ...t, combatRound: n } : { ...t, round: n };

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
  const phase: Phase = raw.phase === "combat" ? "combat" : "crawl";
  const t: Tracker = {
    entries,
    phase,
    current: null,
    round: parseCount(raw.round),
    combatRound: phase === "combat" ? parseCount(raw.combatRound) : 0,
    saved: phase === "combat" ? parseSaved(raw.saved) : null,
  };
  // A turn only exists inside a round, and only for a living entry.
  const current = typeof raw.current === "string" && entries.some((e) => e.id === raw.current && !e.dead) ? raw.current : null;
  return current && phaseRound(t) > 0 ? { ...t, current } : t;
};

const parseCount = (raw: unknown): number =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? Math.min(raw, 9999) : 0;

const parseSaved = (raw: unknown): SavedRoll[] | null => {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const saved: SavedRoll[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || typeof s[0] !== "string" || s[0].length > 64 || seen.has(s[0])) continue;
    seen.add(s[0]);
    saved.push([s[0], parseRoll(s[1])]);
    if (saved.length === MAX_ENTRIES) break;
  }
  return saved;
};

// Entries whose token no longer exists drop out (the GM row always stays).
// Returns the same object when nothing changed.
export const prune = (t: Tracker, exists: (id: string) => boolean): Tracker => {
  const entries = t.entries.filter((e) => e.id === GM_ENTRY || exists(e.id));
  if (entries.length === t.entries.length) return t;
  return withEntries(t, entries);
};

// The order turns are taken in: living entries only (never empty, the GM row
// can't die).
export const turnOrder = (t: Tracker): Entry[] => t.entries.filter((e) => !e.dead);

// ▶: the next living entry's turn. Between rounds, or after the last turn,
// a new round of the current phase starts at the top.
export const next = (t: Tracker): Tracker => {
  const order = turnOrder(t);
  const i = t.current === null ? -1 : order.findIndex((e) => e.id === t.current);
  if (i === -1 || i === order.length - 1) return { ...withPhaseRound(t, phaseRound(t) + 1), current: order[0].id };
  return { ...t, current: order[i + 1].id };
};

// ◀: back one turn, across rounds, but not before this phase's first turn.
export const previous = (t: Tracker): Tracker => {
  if (t.current === null) return t;
  const order = turnOrder(t);
  const i = order.findIndex((e) => e.id === t.current);
  if (i > 0) return { ...t, current: order[i - 1].id };
  if (phaseRound(t) <= 1) return t;
  return { ...withPhaseRound(t, phaseRound(t) - 1), current: order[order.length - 1].id };
};

// Combat starts a fresh count of combat rounds; the crawl count waits.
// With clearRolls (the book's "new initiative", p. 88) the crawl rolls and
// order are kept aside and every roll is cleared for the combat roll.
export const toCombat = (t: Tracker, clearRolls: boolean): Tracker => {
  if (t.phase === "combat") return t;
  return {
    ...t,
    phase: "combat",
    current: null,
    combatRound: 0,
    saved: clearRolls ? t.entries.map((e) => [e.id, e.roll]) : null,
    entries: clearRolls ? t.entries.map((e) => (e.roll === null ? e : { ...e, roll: null })) : t.entries,
  };
};

// Back to crawling. If combat cleared the rolls, the crawl order and rolls
// come back; anyone added during combat keeps their place after them.
export const toCrawl = (t: Tracker): Tracker => {
  if (t.phase === "crawl") return t;
  let entries = t.entries;
  if (t.saved) {
    const saved = new Map(t.saved.map(([id, roll], i) => [id, { roll, i }]));
    const kept = t.entries.filter((e) => saved.has(e.id)).sort((a, b) => saved.get(a.id)!.i - saved.get(b.id)!.i);
    entries = [
      ...kept.map((e) => ({ ...e, roll: saved.get(e.id)!.roll })),
      ...t.entries.filter((e) => !saved.has(e.id)),
    ];
  }
  return { ...t, entries, phase: "crawl", current: null, combatRound: 0, saved: null };
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
export const setDead = (t: Tracker, id: string, dead: boolean): Tracker => {
  const entries = id === GM_ENTRY ? null : update(t, id, { dead });
  return entries ? withEntries(t, entries) : t;
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
export const toggle = (t: Tracker, ids: string[]): Tracker => {
  const have = new Set(t.entries.map((e) => e.id));
  return ids.length > 0 && ids.every((id) => have.has(id)) ? remove(t, ids) : add(t, ids);
};
