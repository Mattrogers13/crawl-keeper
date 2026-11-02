import { describe, it, expect } from "vitest";

import {
  crawlDie,
  cadence,
  checkMade,
  clockLeft,
  crawlRoundStarted,
  crawlRoundUndone,
  cryptoRand,
  due,
  emptyCrawl,
  lastFor,
  omen,
  parseCrawl,
  resetClock,
  resetCrawlRounds,
  rollCheck,
  rollClock,
  rollFor,
  roundsToCheck,
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
    expect(parseCrawl({ danger: "chaos", clock: 99 })).toMatchObject({ danger: "unsafe", clock: 40 });
    expect(parseCrawl({ clock: 33 }).clock).toBe(33);
  });

  it("lastCheck runs at most the longest cadence ahead, so bad data can't switch checks off", () => {
    const c = parseCrawl({ crawlRounds: 2, lastCheck: 9999 });
    expect(c.lastCheck).toBe(5);
    expect(due(rounds(c, 4), "clock", false)).toBe(true);
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
  it("cadence: Unsafe 3, Risky 2, Deadly 1; every round in total darkness, whatever the danger (p. 84)", () => {
    expect(cadence(crawl({ danger: "unsafe" }), false)).toBe(3);
    expect(cadence(crawl({ danger: "risky" }), false)).toBe(2);
    expect(cadence(crawl({ danger: "deadly" }), false)).toBe(1);
    expect(cadence(crawl({ danger: "unsafe" }), true)).toBe(1);
    // The map's own switch is only an input: the caller decides (isDark).
    expect(cadence(crawl({ danger: "unsafe", dark: true }), false)).toBe(3);
  });

  it("in darkness a check is due every crawl round, and the danger level stays", () => {
    let c = rounds(crawl({ danger: "unsafe" }), 1);
    expect([due(c, "standard", false), due(c, "standard", true), roundsToCheck(c, true)]).toEqual([false, true, 0]);
    c = rollCheck(c, dice(6, 4), true);
    expect(c.lastCheck).toBe(1);
    expect(due(rounds(c, 1), "standard", true)).toBe(true);
    expect(c.danger).toBe("unsafe");
    expect(due(rounds(crawl(), 1), "manual", true)).toBe(true);
    expect(checkMade(rounds(crawl(), 1), true).lastCheck).toBe(1);
  });

  it("a roll shows only in its own mode", () => {
    const check = rollCheck(rounds(crawl(), 3), dice(6, 4));
    expect(lastFor(check, "standard")?.kind).toBe("check");
    expect(lastFor(check, "clock")).toBeNull();
    const clock = rollClock(rounds(crawl(), 1), dice(6, 3));
    expect(lastFor(clock, "clock")?.kind).toBe("clock");
    expect(lastFor(clock, "standard")).toBeNull();
  });

  it("due on the 3rd, 6th... crawl round when Unsafe; nothing before the first round", () => {
    let c = crawl();
    expect(due(c, "standard", false)).toBe(false);
    c = rounds(c, 2);
    expect([due(c, "standard", false), roundsToCheck(c, false)]).toEqual([false, 1]);
    c = rounds(c, 1);
    expect(due(c, "standard", false)).toBe(true);
    c = rollCheck(c, dice(6, 4));
    expect(due(c, "standard", false)).toBe(false);
    expect(roundsToCheck(rounds(c, 1), false)).toBe(2);
  });

  it("a 1 on the d6 is an encounter", () => {
    expect(rollCheck(crawl(), dice(6, 1)).last).toMatchObject({ kind: "check", dice: [1], encounter: true });
    expect(rollCheck(crawl(), dice(6, 2)).last?.encounter).toBe(false);
  });
});

describe("Crawling Clock", () => {
  it("due once per crawl round", () => {
    let c = rounds(crawl(), 1);
    expect(due(c, "clock", false)).toBe(true);
    c = rollClock(c, dice(6, 3));
    expect(due(c, "clock", false)).toBe(false);
    expect(due(rounds(c, 1), "clock", false)).toBe(true);
  });

  it("the crawling die takes off the clock; a d8 in darkness", () => {
    expect(rollClock(crawl(), dice(6, 4))).toMatchObject({ clock: 16, last: { dice: [4], sides: 6, before: 20, after: 16 } });
    expect(rollClock(crawl(), dice(8, 7), 20, true)).toMatchObject({ clock: 13, last: { sides: 8 } });
    expect(crawlDie(true)).toBe(8);
    expect(crawlDie(false)).toBe(6);
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


  it("an extra check (a loud noise, p. 112) leaves the schedule alone; a due one resets it", () => {
    const early = rollCheck(rounds(crawl({ danger: "unsafe" }), 2), dice(6, 4));
    expect(early).toMatchObject({ lastCheck: 0, last: { kind: "check" } });
    expect(due(crawlRoundStarted(early), "standard", false)).toBe(true);
    const onTime = rollCheck(rounds(crawl({ danger: "unsafe" }), 3), dice(6, 4));
    expect(onTime.lastCheck).toBe(3);
  });

  it("New clock for a new dangerous place (full for either size); nothing to reset keeps the object", () => {
    const reset = resetClock(crawl({ clock: 9 }));
    expect([clockLeft(reset, 20), clockLeft(reset, 40)]).toEqual([20, 40]);
    const fresh = crawl();
    expect(resetClock(fresh)).toBe(fresh);
  });
});

describe("2d20 clock", () => {
  it("a fresh clock is 40; a 1d20 clock reads the same map as 20", () => {
    expect(clockLeft(crawl(), 40)).toBe(40);
    expect(clockLeft(crawl(), 20)).toBe(20);
    expect(rollClock(crawl(), dice(6, 4))).toMatchObject({ clock: 16, last: { before: 20, after: 16 } });
  });

  it("runs down one die and on into the next", () => {
    expect(rollClock(crawl(), dice(6, 4), 40)).toMatchObject({ clock: 36, last: { before: 40, after: 36, encounter: false } });
    expect(rollClock(crawl({ clock: 22 }), dice(6, 5), 40)).toMatchObject({ clock: 17, last: { encounter: false } });
  });

  it("an encounter only when both dice are empty; the overflow carries into a fresh 40", () => {
    expect(rollClock(crawl({ clock: 3 }), dice(6, 5), 40)).toMatchObject({ clock: 38, last: { encounter: true, before: 3, after: 38 } });
  });

  it("omens on the last die only", () => {
    expect(omen(crawl({ clock: 25 }))).toBe(false);
    expect(omen(crawl({ clock: 5 }))).toBe(true);
  });

  it("rollFor passes the size", () => {
    expect(rollFor("clock", 40)(crawl(), dice(6, 2)).clock).toBe(38);
  });
});

describe("manual (encounter checks and clock off)", () => {
  it("due on the standard cadence; its roll is a d6 check", () => {
    const c = rounds(crawl({ danger: "risky", last: { kind: "clock", dice: [3], sides: 6, before: 20, after: 17, encounter: false } }), 2);
    expect(due(c, "manual", false)).toBe(true);
    expect(due(rounds(crawl({ danger: "risky" }), 1), "manual", false)).toBe(false);
    expect(lastFor(c, "manual")).toBeNull();
    const rolled = rollFor("manual")(c, dice(6, 1));
    expect(rolled).toMatchObject({ lastCheck: 2, clock: c.clock, last: { kind: "check", dice: [1], encounter: true } });
    expect(lastFor(rolled, "manual")?.kind).toBe("check");
  });

  it("checkMade counts a due check; not due keeps the object", () => {
    const c = rounds(crawl({ danger: "risky" }), 2);
    expect(checkMade(c)).toMatchObject({ lastCheck: 2, last: null });
    expect(due(checkMade(c), "manual", false)).toBe(false);
    const early = rounds(crawl({ danger: "risky" }), 1);
    expect(checkMade(early)).toBe(early);
  });
});

describe("rounds", () => {
  it("an old doc's one-level roll undo is dropped on read (the global undo replaced it)", () => {
    expect(parseCrawl({ undo: { clock: 20, lastCheck: 0 } })).not.toHaveProperty("undo");
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
    expect(due(back, "clock", false)).toBe(false);
    expect(due(crawlRoundStarted(back), "clock", false)).toBe(false);
    expect(due(crawlRoundStarted(crawlRoundStarted(back)), "clock", false)).toBe(true);
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
