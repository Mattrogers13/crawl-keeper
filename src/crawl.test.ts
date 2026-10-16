import { describe, it, expect } from "vitest";

import {
  CLOCK_START,
  cadence,
  clockAfterCombat,
  crawlRoundStarted,
  crawlRoundUndone,
  cryptoRand,
  due,
  emptyCrawl,
  omen,
  parseCrawl,
  resetClock,
  resetCrawlRounds,
  rollCheck,
  rollClock,
  roundsToCheck,
  undoRoll,
  type Crawl,
} from "./crawl";

// A die that rolls these faces in order (rand values pick the face).
const dice = (sides: number, ...faces: number[]) => {
  let i = 0;
  return () => (faces[i++] - 1 + 0.5) / sides;
};
const crawl = (c: Partial<Crawl> = {}): Crawl => ({ ...emptyCrawl(), ...c });
const rounds = (c: Crawl, n: number) => Array.from({ length: n }).reduce<Crawl>((acc) => crawlRoundStarted(acc), c);

describe("parseCrawl", () => {
  it("defaults junk; keeps well-formed fields", () => {
    expect(parseCrawl(undefined)).toEqual(emptyCrawl());
    expect(parseCrawl({ danger: "deadly", dark: true, clock: 7, crawlRounds: 5, lastCheck: 9, junk: 1 })).toMatchObject({
      danger: "deadly",
      dark: true,
      clock: 7,
      crawlRounds: 5,
      lastCheck: 5,
    });
    expect(parseCrawl({ danger: "chaos", clock: 99 })).toMatchObject({ danger: "unsafe", clock: CLOCK_START });
  });

  it("keeps a sane last roll and drops a broken one", () => {
    const c = parseCrawl({ last: { kind: "clock", dice: [6, 6, 2, 9, "x"], sides: 6, before: 20, after: 6, encounter: false } });
    expect(c.last).toEqual({ kind: "clock", dice: [6, 6, 2], sides: 6, before: 20, after: 6, encounter: false });
    expect(parseCrawl({ last: { dice: [] } }).last).toBeNull();
  });

  it("an old 'rolled early' result (no dice) is dropped", () => {
    expect(parseCrawl({ last: { kind: "early", dice: [], before: 4, after: 20, encounter: true } }).last).toBeNull();
  });
});

describe("standard checks (core p. 112)", () => {
  it("cadence: Unsafe 3, Risky 2, Deadly 1; darkness every round", () => {
    expect(cadence(crawl({ danger: "unsafe" }))).toBe(3);
    expect(cadence(crawl({ danger: "risky" }))).toBe(2);
    expect(cadence(crawl({ danger: "deadly" }))).toBe(1);
    expect(cadence(crawl({ danger: "unsafe", dark: true }))).toBe(1);
  });

  it("due on the 3rd, 6th... crawl round when Unsafe; nothing before the first round", () => {
    let c = crawl();
    expect(due(c, "standard")).toBe(false);
    c = rounds(c, 2);
    expect([due(c, "standard"), roundsToCheck(c)]).toEqual([false, 1]);
    c = rounds(c, 1);
    expect(due(c, "standard")).toBe(true);
    c = rollCheck(c, dice(6, 4));
    expect(due(c, "standard")).toBe(false);
    expect(roundsToCheck(rounds(c, 1))).toBe(2);
  });

  it("a 1 on the d6 is an encounter", () => {
    expect(rollCheck(crawl(), dice(6, 1)).last).toMatchObject({ kind: "check", dice: [1], encounter: true });
    expect(rollCheck(crawl(), dice(6, 2)).last?.encounter).toBe(false);
  });
});

describe("Crawling Clock", () => {
  it("due once per crawl round", () => {
    let c = rounds(crawl(), 1);
    expect(due(c, "clock")).toBe(true);
    c = rollClock(c, dice(6, 3));
    expect(due(c, "clock")).toBe(false);
    expect(due(rounds(c, 1), "clock")).toBe(true);
  });

  it("the crawling die takes off the clock; a d8 in darkness", () => {
    expect(rollClock(crawl(), dice(6, 4))).toMatchObject({ clock: 16, last: { dice: [4], sides: 6, before: 20, after: 16 } });
    expect(rollClock(crawl({ dark: true }), dice(8, 7))).toMatchObject({ clock: 13, last: { sides: 8 } });
  });

  it("the max explodes: roll again and add, up to 10 dice", () => {
    expect(rollClock(crawl(), dice(6, 6, 6, 2)).last).toMatchObject({ dice: [6, 6, 2], after: 6 });
    const tenSixes = rollClock(crawl({ clock: 20 }), dice(6, ...Array(12).fill(6)));
    expect(tenSixes.last?.dice).toHaveLength(10);
  });

  it("at 0: an encounter; the overflow carries into the next clock", () => {
    expect(rollClock(crawl({ clock: 3 }), dice(6, 3))).toMatchObject({ clock: 20, last: { encounter: true, after: 20 } });
    expect(rollClock(crawl({ clock: 3 }), dice(6, 5))).toMatchObject({ clock: 18, last: { encounter: true, before: 3, after: 18 } });
  });

  it("omens at 5 or lower", () => {
    expect(omen(crawl({ clock: 6 }))).toBe(false);
    expect(omen(crawl({ clock: 5 }))).toBe(true);
  });

  it("back from combat: a fresh clock, unless the clock's encounter already started one", () => {
    expect(clockAfterCombat(crawl({ clock: 9 })).clock).toBe(20);
    const afterEncounter = rollClock(crawl({ clock: 3 }), dice(6, 5));
    expect(clockAfterCombat(afterEncounter)).toBe(afterEncounter);
    expect(afterEncounter.clock).toBe(18);
  });

  it("New clock for a new dangerous place; nothing to reset keeps the object", () => {
    expect(resetClock(crawl({ clock: 9 })).clock).toBe(20);
    const fresh = crawl();
    expect(resetClock(fresh)).toBe(fresh);
  });
});

describe("undo, rounds", () => {
  it("one-level undo of the last roll", () => {
    const before = rounds(crawl({ clock: 12 }), 1);
    const after = rollClock(before, dice(6, 5));
    const undone = undoRoll(after);
    expect(undone).toMatchObject({ clock: 12, lastCheck: before.lastCheck, last: null, undo: null });
    expect(undoRoll(undone)).toBe(undone);
  });

  it("◀ over a crawl round takes it back; reset starts the count over", () => {
    const c = rollCheck(rounds(crawl(), 3), dice(6, 4));
    expect(crawlRoundUndone(c)).toMatchObject({ crawlRounds: 2, lastCheck: 2 });
    expect(resetCrawlRounds(c)).toMatchObject({ crawlRounds: 0, lastCheck: 0 });
    const zero = crawl();
    expect(resetCrawlRounds(zero)).toBe(zero);
  });
});

describe("cryptoRand", () => {
  it("stays in [0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const r = cryptoRand();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});
