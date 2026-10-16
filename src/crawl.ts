// The crawl: encounter checks on the GM's turn of each crawl round.
// Pure (dice come in as a function) so every rule is unit-tested. Stored in
// the map's tracker doc: each dungeon has its own clock, and a turn plus its
// crawl roll save in one write.
//
// Standard (core p. 112): every 3 crawl rounds when Unsafe, 2 when Risky,
// every round when Deadly or in total darkness (p. 84); 1d6, encounter on 1.
//
// Crawling Clock (sheet in sources/; after Goblin Punch's "Underclock"):
// starts at 20 in a dangerous place; each crawl round the GM rolls the
// crawling die (d6, d8 in darkness), rolling again and adding while it shows
// its max (capped at 10 dice), and takes it off the clock. At 0 or below: an
// encounter, and the overflow carries into the next clock (20 minus it).
// At 1 to 5: an omen; the GM may roll the encounter early.

export type Danger = "unsafe" | "risky" | "deadly";
export type EncounterMode = "standard" | "clock";

export const CLOCK_START = 20;
const MAX_DICE = 10;
const CADENCE: Record<Danger, number> = { unsafe: 3, risky: 2, deadly: 1 };

export type CrawlRoll = {
  // check: a 1-in-6 check; clock: the crawling die; early: the GM rolled the
  // encounter at an omen.
  kind: "check" | "clock" | "early";
  dice: number[];
  sides: number;
  // The clock before and after (clock rolls).
  before: number;
  after: number;
  encounter: boolean;
};

type CrawlCore = {
  danger: Danger;
  // Total darkness: checks every round; the crawling die steps up to a d8.
  dark: boolean;
  clock: number;
  // Crawl rounds started on this map, and the count at the last check or
  // clock roll (combat rounds don't count, p. 112).
  crawlRounds: number;
  lastCheck: number;
  last: CrawlRoll | null;
};

export type Crawl = CrawlCore & {
  // One-level undo of the last roll (its own `last` isn't kept: undoing
  // clears the result shown).
  undo: Omit<CrawlCore, "last"> | null;
};

export const emptyCrawl = (): Crawl => ({
  danger: "unsafe",
  dark: false,
  clock: CLOCK_START,
  crawlRounds: 0,
  lastCheck: 0,
  last: null,
  undo: null,
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
const parseDanger = (v: unknown): Danger => (v === "risky" || v === "deadly" ? v : "unsafe");

const parseRoll = (raw: unknown): CrawlRoll | null => {
  if (!isObject(raw) || !Array.isArray(raw.dice)) return null;
  const sides = raw.sides === 8 ? 8 : 6;
  const dice = raw.dice.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= sides).slice(0, MAX_DICE);
  const kind = raw.kind === "clock" || raw.kind === "early" ? raw.kind : "check";
  // An encounter rolled early has no dice; any other roll has some.
  if (dice.length === 0 && kind !== "early") return null;
  return {
    kind,
    dice,
    sides,
    before: intIn(raw.before, 1, CLOCK_START, CLOCK_START),
    after: intIn(raw.after, 1, CLOCK_START, CLOCK_START),
    encounter: raw.encounter === true,
  };
};

const parseCore = (r: Record<string, unknown>): Omit<CrawlCore, "last"> => {
  const crawlRounds = intIn(r.crawlRounds, 0, 9999, 0);
  return {
    danger: parseDanger(r.danger),
    dark: r.dark === true,
    clock: intIn(r.clock, 1, CLOCK_START, CLOCK_START),
    crawlRounds,
    lastCheck: Math.min(intIn(r.lastCheck, 0, 9999, 0), crawlRounds),
  };
};

// Scene metadata is untrusted: keep only well-formed fields.
export const parseCrawl = (raw: unknown): Crawl => {
  if (!isObject(raw)) return emptyCrawl();
  return { ...parseCore(raw), last: parseRoll(raw.last), undo: isObject(raw.undo) ? parseCore(raw.undo) : null };
};

// A fair die from a random source in [0, 1).
export type Rand = () => number;
const roll = (sides: number, rand: Rand) => Math.min(sides, Math.floor(rand() * sides) + 1);

// The browser's crypto, not Math.random. From 32 random bits the bias on a
// d6 or d8 is under one in 500 million.
export const cryptoRand: Rand = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

export const crawlDie = (c: Crawl) => (c.dark ? 8 : 6);

// Crawl rounds between checks: every round in darkness or when Deadly.
export const cadence = (c: Crawl) => (c.dark ? 1 : CADENCE[c.danger]);

// Is a check (standard) or a clock roll due in this crawl round?
export const due = (c: Crawl, mode: EncounterMode) =>
  c.crawlRounds > 0 && c.crawlRounds - c.lastCheck >= (mode === "clock" ? 1 : cadence(c));

// Crawl rounds until the next standard check (0 = due now).
export const roundsToCheck = (c: Crawl) => Math.max(0, cadence(c) - (c.crawlRounds - c.lastCheck));

const snapshot = (c: Crawl): Omit<CrawlCore, "last"> => ({
  danger: c.danger,
  dark: c.dark,
  clock: c.clock,
  crawlRounds: c.crawlRounds,
  lastCheck: c.lastCheck,
});

// Standard: roll 1d6, an encounter on 1. Counts as this round's check.
export const rollCheck = (c: Crawl, rand: Rand): Crawl => {
  const d = roll(6, rand);
  return {
    ...c,
    lastCheck: c.crawlRounds,
    last: { kind: "check", dice: [d], sides: 6, before: c.clock, after: c.clock, encounter: d === 1 },
    undo: snapshot(c),
  };
};

// Clock: roll the crawling die (exploding on its max), take it off the
// clock; at 0 or below an encounter and the overflow carries over.
export const rollClock = (c: Crawl, rand: Rand): Crawl => {
  const sides = crawlDie(c);
  const dice = [roll(sides, rand)];
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE) dice.push(roll(sides, rand));
  const total = dice.reduce((a, b) => a + b, 0);
  const left = c.clock - total;
  const encounter = left <= 0;
  const after = encounter ? Math.max(1, CLOCK_START + left) : left;
  return {
    ...c,
    clock: after,
    lastCheck: c.crawlRounds,
    last: { kind: "clock", dice, sides, before: c.clock, after, encounter },
    undo: snapshot(c),
  };
};

// The clock is low (1 to 5): the GM may roll the encounter early.
export const omen = (c: Crawl) => c.clock <= 5;

// The GM rolls the encounter at an omen: it happens now; a fresh clock.
export const encounterNow = (c: Crawl): Crawl => ({
  ...c,
  clock: CLOCK_START,
  last: { kind: "early", dice: [], sides: 6, before: c.clock, after: CLOCK_START, encounter: true },
  undo: snapshot(c),
});

// Back to crawling after a fight: a fresh clock, unless the clock's own
// encounter already started one (keeping its carry-over). The last result
// stays on show.
export const clockAfterCombat = (c: Crawl): Crawl =>
  c.clock === CLOCK_START || c.last?.encounter ? c : { ...c, clock: CLOCK_START, undo: null };

// Entering a new dangerous place: a fresh clock.
export const resetClock = (c: Crawl): Crawl =>
  c.clock === CLOCK_START && c.last === null ? c : { ...c, clock: CLOCK_START, last: null, undo: snapshot(c) };

export const undoRoll = (c: Crawl): Crawl => (c.undo ? { ...c, ...c.undo, last: null, undo: null } : c);

export const setDanger = (c: Crawl, danger: Danger): Crawl => (c.danger === danger ? c : { ...c, danger });
export const setDark = (c: Crawl, dark: boolean): Crawl => (c.dark === dark ? c : { ...c, dark });

// A new crawl round started (▶ wrapped while crawling), or ◀ went back over
// one. Reset rounds starts the count over.
export const crawlRoundStarted = (c: Crawl): Crawl => ({ ...c, crawlRounds: c.crawlRounds + 1 });
export const crawlRoundUndone = (c: Crawl): Crawl => {
  const crawlRounds = Math.max(0, c.crawlRounds - 1);
  return { ...c, crawlRounds, lastCheck: Math.min(c.lastCheck, crawlRounds) };
};
export const resetCrawlRounds = (c: Crawl): Crawl =>
  c.crawlRounds === 0 && c.lastCheck === 0 ? c : { ...c, crawlRounds: 0, lastCheck: 0 };
