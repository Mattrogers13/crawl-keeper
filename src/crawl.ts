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
// At 1 to 5: an omen. The GM may roll on the encounter table now to know
// what's coming and telegraph it; the encounter still happens at 0.

export type Danger = "unsafe" | "risky" | "deadly";
export type EncounterMode = "standard" | "clock";

import { intIn, isObject, parseCount } from "./parse";

export const CLOCK_START = 20;
const MAX_DICE = 10;
const CADENCE: Record<Danger, number> = { unsafe: 3, risky: 2, deadly: 1 };
// How far lastCheck may run ahead of crawlRounds (◀ back over rolled rounds).
// Past the longest cadence it would only hold checks off, so it's capped
// there, and bad data can't switch checks off for good.
const MAX_AHEAD = Math.max(...Object.values(CADENCE));
const ahead = (crawlRounds: number, lastCheck: number) => Math.min(lastCheck, crawlRounds + MAX_AHEAD);

export type CrawlRoll = {
  // check: a 1-in-6 check; clock: the crawling die.
  kind: "check" | "clock";
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
  // clock roll (combat rounds don't count, p. 112). lastCheck can run ahead of
  // crawlRounds after ◀ back over a round: that round's roll stays taken.
  crawlRounds: number;
  lastCheck: number;
  last: CrawlRoll | null;
  // The clock holds an encounter's carry-over that no fight has used yet:
  // the next return from combat keeps it instead of starting a fresh clock.
  carry: boolean;
};

// What a roll changes, kept for a one-level undo (nothing else: danger,
// darkness and rounds are the GM's since).
type Undo = { clock: number; lastCheck: number; carry: boolean };

export type Crawl = CrawlCore & {
  // Undoing clears the result shown.
  undo: Undo | null;
};

export const emptyCrawl = (): Crawl => ({
  danger: "unsafe",
  dark: false,
  clock: CLOCK_START,
  crawlRounds: 0,
  lastCheck: 0,
  last: null,
  carry: false,
  undo: null,
});

const parseDanger = (v: unknown): Danger => (v === "risky" || v === "deadly" ? v : "unsafe");

const parseRoll = (raw: unknown): CrawlRoll | null => {
  if (!isObject(raw) || !Array.isArray(raw.dice)) return null;
  const sides = raw.sides === 8 ? 8 : 6;
  const dice = raw.dice.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= sides).slice(0, MAX_DICE);
  if (dice.length === 0) return null;
  const kind = raw.kind === "clock" ? "clock" : "check";
  return {
    kind,
    dice,
    sides,
    before: intIn(raw.before, 1, CLOCK_START) ?? CLOCK_START,
    after: intIn(raw.after, 1, CLOCK_START) ?? CLOCK_START,
    encounter: raw.encounter === true,
  };
};

const parseClock = (v: unknown) => intIn(v, 1, CLOCK_START) ?? CLOCK_START;

// Scene metadata is untrusted: keep only well-formed fields.
export const parseCrawl = (raw: unknown): Crawl => {
  if (!isObject(raw)) return emptyCrawl();
  const crawlRounds = parseCount(raw.crawlRounds);
  return {
    danger: parseDanger(raw.danger),
    dark: raw.dark === true,
    clock: parseClock(raw.clock),
    crawlRounds,
    lastCheck: ahead(crawlRounds, parseCount(raw.lastCheck)),
    last: parseRoll(raw.last),
    carry: raw.carry === true,
    undo: isObject(raw.undo)
      ? {
          clock: parseClock(raw.undo.clock),
          lastCheck: ahead(crawlRounds, parseCount(raw.undo.lastCheck)),
          carry: raw.undo.carry === true,
        }
      : null,
  };
};

// A fair die from a random source in [0, 1).
export type Rand = () => number;
export const rollDie = (sides: number, rand: Rand) => Math.min(sides, Math.floor(rand() * sides) + 1);

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

const snapshot = (c: Crawl): Undo => ({ clock: c.clock, lastCheck: c.lastCheck, carry: c.carry });

// Standard: roll 1d6, an encounter on 1. Counts as this round's check.
export const rollCheck = (c: Crawl, rand: Rand): Crawl => {
  const d = rollDie(6, rand);
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
  const dice = [rollDie(sides, rand)];
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE) dice.push(rollDie(sides, rand));
  const total = dice.reduce((a, b) => a + b, 0);
  const left = c.clock - total;
  const encounter = left <= 0;
  const after = encounter ? Math.max(1, CLOCK_START + left) : left;
  return {
    ...c,
    clock: after,
    lastCheck: c.crawlRounds,
    last: { kind: "clock", dice, sides, before: c.clock, after, encounter },
    carry: encounter,
    undo: snapshot(c),
  };
};

// The clock is low (1 to 5): an omen (sheet: "Spoors and Omens"). The GM
// may roll the encounter on their table now and telegraph it; it still
// happens when the clock hits 0. (v0.2's encounter roller can do that roll.)
export const omen = (c: Crawl) => c.clock <= 5;

// Back to crawling after a fight: a fresh clock, unless the clock's own
// encounter already started one (keeping its carry-over, once: a second
// fight before the next roll gets a fresh clock). The last result stays on
// show.
export const clockAfterCombat = (c: Crawl): Crawl => {
  if (c.carry) return { ...c, carry: false };
  return c.clock === CLOCK_START ? c : { ...c, clock: CLOCK_START, undo: null };
};

// Entering a new dangerous place: a fresh clock.
export const resetClock = (c: Crawl): Crawl =>
  c.clock === CLOCK_START && c.last === null && !c.carry ? c : { ...c, clock: CLOCK_START, last: null, carry: false, undo: snapshot(c) };

export const undoRoll = (c: Crawl): Crawl => (c.undo ? { ...c, ...c.undo, last: null, undo: null } : c);

export const setDanger = (c: Crawl, danger: Danger): Crawl => (c.danger === danger ? c : { ...c, danger });
export const setDark = (c: Crawl, dark: boolean): Crawl => (c.dark === dark ? c : { ...c, dark });

// A new crawl round started (▶ wrapped while crawling), or ◀ went back over
// one. Reset rounds starts the count over.
export const crawlRoundStarted = (c: Crawl): Crawl => ({ ...c, crawlRounds: c.crawlRounds + 1 });
// Going back over a round keeps lastCheck: the later round's roll stays
// taken, so ▶ forward again doesn't call for it twice.
export const crawlRoundUndone = (c: Crawl): Crawl => {
  const crawlRounds = Math.max(0, c.crawlRounds - 1);
  return { ...c, crawlRounds, lastCheck: ahead(crawlRounds, c.lastCheck) };
};
export const resetCrawlRounds = (c: Crawl): Crawl =>
  c.crawlRounds === 0 && c.lastCheck === 0 && c.undo === null ? c : { ...c, crawlRounds: 0, lastCheck: 0, undo: null };
