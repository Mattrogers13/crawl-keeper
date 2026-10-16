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
    expect(parseCrawl({ danger: "deadly", dark: true, clock: 7, crawlRounds: 5, lastCheck: 6, junk: 1 })).toMatchObject({
      danger: "deadly",
      dark: true,
      clock: 7,
      crawlRounds: 5,
      lastCheck: 6,
    });
    expect(parseCrawl({ danger: "chaos", clock: 99 })).toMatchObject({ danger: "unsafe", clock: CLOCK_START });
  });

  it("lastCheck runs at most the longest cadence ahead, so bad data can't switch checks off", () => {
    const c = parseCrawl({ crawlRounds: 2, lastCheck: 9999, undo: { clock: 20, lastCheck: 9999 } });
    expect([c.lastCheck, c.undo?.lastCheck]).toEqual([5, 5]);
    expect(due(rounds(c, 4), "clock")).toBe(true);
  });

  it("counts over the cap clamp instead of resetting to 0", () => {
    expect(parseCrawl({ crawlRounds: 10000, lastCheck: 9999 })).toMatchObject({ crawlRounds: 9999, lastCheck: 9999 });
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
    const back = clockAfterCombat(afterEncounter);
    expect(back).toMatchObject({ clock: 18, last: afterEncounter.last });
  });

  it("a second fight before the next roll: a fresh clock (the carry-over is used once)", () => {
    const once = clockAfterCombat(rollClock(crawl({ clock: 3 }), dice(6, 5)));
    expect(clockAfterCombat(once).clock).toBe(20);
    // Saved and read back in between, too.
    expect(clockAfterCombat(parseCrawl(JSON.parse(JSON.stringify(once)))).clock).toBe(20);
  });

  it("undoing the clock's encounter roll after the fight puts the clock and carry back", () => {
    const before = crawl({ clock: 3 });
    const undone = undoRoll(clockAfterCombat(rollClock(before, dice(6, 5))));
    expect(undone).toMatchObject({ clock: 3, carry: false, last: null });
  });

  it("an extra check (a loud noise, p. 112) leaves the schedule alone; a due one resets it", () => {
    const early = rollCheck(rounds(crawl({ danger: "unsafe" }), 2), dice(6, 4));
    expect(early).toMatchObject({ lastCheck: 0, last: { kind: "check" } });
    expect(due(crawlRoundStarted(early), "standard")).toBe(true);
    const onTime = rollCheck(rounds(crawl({ danger: "unsafe" }), 3), dice(6, 4));
    expect(onTime.lastCheck).toBe(3);
  });

  it("New clock for a new dangerous place; nothing to reset keeps the object", () => {
    expect(resetClock(crawl({ clock: 9 })).clock).toBe(20);
    const fresh = crawl();
    expect(resetClock(fresh)).toBe(fresh);
  });
});

describe("undo, rounds", () => {
  it("undo puts back only what the roll changed: not danger, darkness or rounds since", () => {
    let c = rollCheck(rounds(crawl({ danger: "unsafe" }), 3), dice(6, 4));
    c = rounds({ ...c, danger: "risky", dark: true }, 3);
    expect(undoRoll(c)).toMatchObject({ danger: "risky", dark: true, crawlRounds: 6, lastCheck: 0, last: null });
  });

  it("back from combat after a standard check's encounter: still a fresh clock", () => {
    const c = { ...rollCheck(crawl({ clock: 9 }), dice(6, 1)), clock: 9 };
    expect(c.last?.encounter).toBe(true);
    expect(clockAfterCombat(c).clock).toBe(20);
  });

  it("one-level undo of the last roll", () => {
    const before = rounds(crawl({ clock: 12 }), 1);
    const after = rollClock(before, dice(6, 5));
    const undone = undoRoll(after);
    expect(undone).toMatchObject({ clock: 12, lastCheck: before.lastCheck, last: null, undo: null });
    expect(undoRoll(undone)).toBe(undone);
  });

  it("◀ back over many rolled rounds keeps lastCheck within the longest cadence", () => {
    let c = rollClock(rounds(crawl(), 10), dice(6, 3));
    for (let i = 0; i < 6; i++) c = crawlRoundUndone(c);
    expect(c).toMatchObject({ crawlRounds: 4, lastCheck: 7 });
  });

  it("◀ over a crawl round takes it back but keeps its roll taken; ▶ forward doesn't call for it again", () => {
    const c = rollClock(rounds(crawl(), 5), dice(6, 3));
    const back = crawlRoundUndone(c);
    expect(back).toMatchObject({ crawlRounds: 4, lastCheck: 5 });
    expect(due(back, "clock")).toBe(false);
    expect(due(crawlRoundStarted(back), "clock")).toBe(false);
    expect(due(crawlRoundStarted(crawlRoundStarted(back)), "clock")).toBe(true);
    expect(resetCrawlRounds(c)).toMatchObject({ crawlRounds: 0, lastCheck: 0, undo: null });
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
