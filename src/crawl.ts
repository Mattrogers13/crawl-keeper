// The crawl: encounter checks on the GM's turn of each crawl round.
// Pure (dice come in as a function) so every rule is unit-tested. Stored in
// the map's tracker doc: each dungeon has its own clock, and a turn plus its
// crawl roll save in one write.
//
// Standard (core p. 112): every 3 crawl rounds when Unsafe, 2 when Risky,
// every round when Deadly; 1d6, encounter on 1. In total darkness a check
// every crawl round (p. 84: "The GM checks for a random encounter every
// crawling round"), the danger level untouched (the toolkit's way; Matt,
// 2026-10-30).
//
// Darkness comes in as `dark`, worked out by the caller (`isDark` in
// lights.ts): the lights when Follow light is on and lights are tracked,
// otherwise the map's own switch (`Crawl.dark`).
//
// Crawling Clock (sheet in sources/; after Goblin Punch's "Underclock"):
// starts at 20 in a dangerous place; each crawl round the GM rolls the
// crawling die (d6, d8 in darkness), rolling again and adding while it shows
// its max (capped at 10 dice), and takes it off the clock. At 0 or below: an
// encounter, and the overflow carries into the next clock (20 minus it).
// At 1 to 5: an omen. The GM may roll on the encounter table now to know
// what's coming and telegraph it; the encounter still happens at 0.
//
// A 2d20 clock (Matt, 2026-10-26) is a 40 clock run down one d20 at a time:
// the front die empties, then the second; the same omen and encounter rules
// on the total.
//
// Manual (Matt, 2026-10-26): no clock and no auto roll. The card says when a
// check is due on the standard cadence; the GM rolls its d6 or one at the
// table, and a due check counts as made when ▶ leaves the GM's turn.

export type Danger = "unsafe" | "risky" | "deadly";
export type EncounterMode = "standard" | "clock" | "manual";
// The Crawling Clock's size: one d20 (20) or two (40).
export type ClockDice = 1 | 2;

import { intIn, isObject, parseCount } from "./parse";

export const CLOCK_DIE = 20;
// The clock is stored as what's left, up to two dice; a 1d20 clock reads it
// capped at 20 (clockLeft). A fresh or reset clock is full for either size,
// so changing the size in Settings needs no write to every map.
const CLOCK_FULL = 2 * CLOCK_DIE;
export const clockStart = (dice: ClockDice) => CLOCK_DIE * dice;
export const clockLeft = (c: Crawl, start: number) => Math.min(c.clock, start);
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
  // The GM's own darkness switch for this map: in charge unless Follow light
  // is on and lights are tracked (isDark in lights.ts).
  dark: boolean;
  clock: number;
  // Crawl rounds started on this map, and the count at the last check or
  // clock roll (combat rounds don't count, p. 112). lastCheck can run ahead of
  // crawlRounds after ◀ back over a round: that round's roll stays taken.
  crawlRounds: number;
  lastCheck: number;
  last: CrawlRoll | null;
};

// (A one-level roll undo lived here until the global undo, src/undo.ts,
// replaced it; an old doc's `undo` field is ignored.)
export type Crawl = CrawlCore;

export const emptyCrawl = (): Crawl => ({
  danger: "unsafe",
  dark: false,
  clock: CLOCK_FULL,
  crawlRounds: 0,
  lastCheck: 0,
  last: null,
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
    before: intIn(raw.before, 1, CLOCK_FULL) ?? CLOCK_DIE,
    after: intIn(raw.after, 1, CLOCK_FULL) ?? CLOCK_DIE,
    encounter: raw.encounter === true,
  };
};

const parseClock = (v: unknown) => intIn(v, 1, CLOCK_FULL) ?? CLOCK_FULL;

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

export const crawlDie = (dark: boolean) => (dark ? 8 : 6);

// Crawl rounds between standard checks: every round in darkness.
export const cadence = (c: Crawl, dark: boolean) => (dark ? 1 : CADENCE[c.danger]);

// Is a check (standard or manual) or a clock roll due in this crawl round?
export const due = (c: Crawl, mode: EncounterMode, dark: boolean) =>
  c.crawlRounds > 0 && c.crawlRounds - c.lastCheck >= (mode === "clock" ? 1 : cadence(c, dark));

// Crawl rounds until the next standard check (0 = due now).
export const roundsToCheck = (c: Crawl, dark: boolean) => Math.max(0, cadence(c, dark) - (c.crawlRounds - c.lastCheck));

// Standard: roll 1d6, an encounter on 1. A due roll counts as this round's
// check; an extra one (a loud noise, p. 112: "The GM might also check for an
// encounter if the characters create a loud disturbance") leaves the schedule
// alone.
export const rollCheck = (c: Crawl, rand: Rand, dark = false): Crawl => {
  const d = rollDie(6, rand);
  return {
    ...c,
    lastCheck: due(c, "standard", dark) ? c.crawlRounds : c.lastCheck,
    last: { kind: "check", dice: [d], sides: 6, before: c.clock, after: c.clock, encounter: d === 1 },
  };
};

// Clock: roll the crawling die (exploding on its max), take it off the
// clock; at 0 or below an encounter and the overflow carries over. `start`
// is the clock's size (20, or 40 for 2d20).
export const rollClock = (c: Crawl, rand: Rand, start = CLOCK_DIE, dark = false): Crawl => {
  const sides = crawlDie(dark);
  const dice = [rollDie(sides, rand)];
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE) dice.push(rollDie(sides, rand));
  const total = dice.reduce((a, b) => a + b, 0);
  const before = clockLeft(c, start);
  const left = before - total;
  const encounter = left <= 0;
  const after = encounter ? Math.max(1, start + left) : left;
  return {
    ...c,
    clock: after,
    lastCheck: c.crawlRounds,
    last: { kind: "clock", dice, sides, before, after, encounter },
  };
};

// The clock is low (1 to 5; on a 2d20 clock, the last die): an omen (sheet: "Spoors and Omens"). The GM
// may roll the encounter on their table now and telegraph it; it still
// happens when the clock hits 0. (v0.2's encounter roller can do that roll.)
export const OMEN_AT = 5;
export const omen = (c: Crawl) => c.clock <= OMEN_AT;

// The last roll if it belongs to this mode: after switching between
// standard checks and the clock, the other mode's roll isn't shown.
export const lastFor = (c: Crawl, mode: EncounterMode): CrawlRoll | null =>
  c.last && c.last.kind === (mode === "clock" ? "clock" : "check") ? c.last : null;

// The card's roll button (and the R hotkey): the mode's roll (manual: a check).
export const rollFor = (mode: EncounterMode, start = CLOCK_DIE, dark = false) => (c: Crawl, rand: Rand) =>
  mode === "clock" ? rollClock(c, rand, start, dark) : rollCheck(c, rand, dark);

// Manual: the GM may have rolled at the table. A due check counts as made
// (nothing to undo: no result was recorded).
export const checkMade = (c: Crawl, dark = false): Crawl => (due(c, "manual", dark) ? { ...c, lastCheck: c.crawlRounds } : c);

// Entering a new dangerous place: a fresh clock (sheet: "The clock begins at
// 20 when the party enters a dangerous location"; full for either size). That and the clock's own
// encounter are the only resets: a fight, keyed or not, leaves the clock
// where it was (decided 2026-10-16, following the sheet).
export const resetClock = (c: Crawl): Crawl =>
  c.clock === CLOCK_FULL && c.last === null ? c : { ...c, clock: CLOCK_FULL, last: null };

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
  c.crawlRounds === 0 && c.lastCheck === 0 ? c : { ...c, crawlRounds: 0, lastCheck: 0 };
