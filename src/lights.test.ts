import { describe, it, expect } from "vitest";

import * as L from "./lights";

const MIN = 60_000;
const T0 = Date.parse("2026-10-27T20:00:00Z");

// Lights on a fake clock: advance(ms) moves time; each helper applies a
// change at the current time, the way the panel does.
const setup = (rule: L.LightingRule = "rideAlong") => {
  let now = T0;
  let n = 0;
  let s = L.setLightingRule(L.emptyLights(), rule);
  const newId = () => `light-${++n}`;
  const t = {
    get s() {
      return s;
    },
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    add: (kind: L.LightKind, tokenId = `token-${n + 1}`, carrier = "", note = "") => {
      s = L.addLight(s, now, newId, { kind, tokenId, carrier, note });
    },
    do: (change: (s: L.Lights, now: number) => L.Lights) => {
      s = change(s, now);
    },
    left: (i: number) => L.remaining(s.lights[i], now),
    light: (i: number) => s.lights[i],
    status: () => L.lightStatus(s, now),
    statuses: () => s.lights.map((l) => l.status),
  };
  return t;
};

describe("lights burn in real time", () => {
  it("rule durations: torch, lantern, Light spell 1 hour; campfire 8 hours", () => {
    const t = setup("separate");
    for (const kind of L.KIND_IDS) t.add(kind);
    expect([0, 1, 2, 3].map(t.left)).toEqual([60 * MIN, 60 * MIN, 60 * MIN, 480 * MIN]);
  });

  it("a torch counts down to the hour and is stored as an end time every client reads alike", () => {
    const t = setup();
    t.add("torch", "aria", "Aria");
    expect(t.light(0).endsAt).toBe(T0 + 60 * MIN);
    t.advance(17 * MIN + 45_000);
    expect(t.left(0)).toBe(42 * MIN + 15_000);
    expect(L.low(t.light(0), t.now())).toBe(false);
    t.advance(33 * MIN);
    expect(L.low(t.light(0), t.now())).toBe(true);
    t.advance(20 * MIN);
    // Dark at 0:00 before anything is written.
    expect(t.status()).toBe("dark");
    expect(L.burnedOut(t.light(0), t.now())).toBe(true);
    t.do(L.settle);
    expect(t.light(0)).toMatchObject({ status: "spent", spentAt: T0 + 60 * MIN, endsAt: null });
  });

  it("a clock set backwards never adds time", () => {
    const t = setup();
    t.add("torch");
    t.advance(-15 * MIN);
    expect(t.left(0)).toBe(60 * MIN);
    t.advance(25 * MIN);
    expect(t.left(0)).toBe(50 * MIN);
  });

  it("no lights tracked means 'none', not dark", () => {
    expect(setup().status()).toBe("none");
  });

  it("a document read hours later is exact: settling spends what ran out", () => {
    const t = setup("separate");
    t.add("torch");
    t.add("campfire");
    const later = T0 + 3 * 60 * MIN;
    const reopened = L.settle(L.parseLights(JSON.parse(JSON.stringify(t.s))), later);
    expect(reopened.lights.map((l) => l.status)).toEqual(["spent", "lit"]);
    expect(L.remaining(reopened.lights[1], later)).toBe(5 * 60 * MIN);
  });
});

describe("lighting rule (p. 84)", () => {
  it("ride along: a new light joins the current timer", () => {
    const t = setup("rideAlong");
    t.add("torch");
    t.advance(40 * MIN);
    t.add("torch");
    expect(t.left(1)).toBe(20 * MIN);
    t.advance(20 * MIN);
    t.do(L.settle);
    expect(t.statuses()).toEqual(["spent", "spent"]);
  });

  it("a campfire never rides along", () => {
    const t = setup("rideAlong");
    t.add("torch");
    t.advance(40 * MIN);
    t.add("campfire");
    expect(t.left(1)).toBe(480 * MIN);
  });

  it("a shuttered lantern is no timer to ride", () => {
    const t = setup("rideAlong");
    t.add("lantern");
    t.do((s, now) => L.toggleShutter(s, now, "light-1"));
    t.add("torch");
    expect(t.left(1)).toBe(60 * MIN);
  });

  it("separate timers: every light gets its own", () => {
    const t = setup("separate");
    t.add("torch");
    t.advance(40 * MIN);
    t.add("torch");
    expect([t.left(0), t.left(1)]).toEqual([20 * MIN, 60 * MIN]);
  });
});

describe("global controls", () => {
  it("Pause freezes every light; Resume picks up where it left off", () => {
    const t = setup("separate");
    t.add("torch");
    t.add("lightSpell");
    t.advance(5 * MIN);
    t.do(L.pause);
    t.advance(30 * MIN);
    expect(t.left(0)).toBe(55 * MIN);
    t.add("torch");
    t.advance(10 * MIN);
    expect(t.left(2)).toBe(60 * MIN);
    t.do(L.resume);
    t.advance(5 * MIN);
    expect([0, 1, 2].map(t.left)).toEqual([50 * MIN, 50 * MIN, 55 * MIN]);
  });

  it("Time passes takes time off lit lights only, shuttered lanterns included; 0 spends them", () => {
    const t = setup("separate");
    t.add("torch");
    t.add("torch");
    t.do((s, now) => L.putOut(s, now, "light-2"));
    t.add("lantern");
    t.do((s, now) => L.toggleShutter(s, now, "light-3"));
    t.advance(30 * MIN);
    t.do((s, now) => L.timePasses(s, now, 20 * MIN));
    expect([t.left(0), t.left(1), t.left(2)]).toEqual([10 * MIN, 60 * MIN, 10 * MIN]);
    t.do((s, now) => L.timePasses(s, now, 15 * MIN));
    expect(t.statuses()).toEqual(["spent", "out", "spent"]);
    expect(t.light(0).spentAt).toBe(t.now());
  });

  it("Time passes works while paused and stays paused", () => {
    const t = setup();
    t.add("torch");
    t.do(L.pause);
    t.do((s, now) => L.timePasses(s, now, 25 * MIN));
    t.advance(10 * MIN);
    expect(t.left(0)).toBe(35 * MIN);
  });

  it("Time passes with nothing lit changes nothing", () => {
    const t = setup();
    t.add("torch");
    t.do((s, now) => L.putOut(s, now, "light-1"));
    const before = t.s;
    t.do((s, now) => L.timePasses(s, now, 10 * MIN));
    expect(t.s).toBe(before);
  });

  it("Put lights out keeps the time; relight continues", () => {
    const t = setup("separate");
    t.add("torch");
    t.add("lantern");
    t.advance(20 * MIN);
    t.do(L.putAllOut);
    expect(t.status()).toBe("dark");
    t.advance(60 * MIN);
    expect([t.left(0), t.left(1)]).toEqual([40 * MIN, 40 * MIN]);
    t.do((s, now) => L.relight(s, now, "light-1"));
    expect(t.status()).toBe("lit");
  });
});

describe("lanterns", () => {
  it("the shutter makes it dark while the oil burns; refill gives an hour", () => {
    const t = setup();
    t.add("lantern");
    t.advance(45 * MIN);
    t.do((s, now) => L.toggleShutter(s, now, "light-1"));
    expect(t.status()).toBe("dark");
    t.do((s, now) => L.refillOil(s, now, "light-1"));
    expect(t.left(0)).toBe(60 * MIN);
    t.do((s, now) => L.toggleShutter(s, now, "light-1"));
    expect(t.status()).toBe("lit");
  });

  it("a spent lantern can be refilled and relit", () => {
    const t = setup();
    t.add("lantern");
    t.do((s, now) => L.timePasses(s, now, 60 * MIN));
    expect(t.light(0).status).toBe("spent");
    t.do((s, now) => L.refillOil(s, now, "light-1"));
    expect(t.light(0).status).toBe("out");
    t.do((s, now) => L.relight(s, now, "light-1"));
    expect(t.status()).toBe("lit");
  });

  it("only lanterns shutter or take oil", () => {
    const t = setup();
    t.add("torch");
    expect(() => t.do((s, now) => L.toggleShutter(s, now, "light-1"))).toThrow(/lanterns/);
    expect(() => t.do((s, now) => L.refillOil(s, now, "light-1"))).toThrow(/lanterns/);
  });
});

describe("tokens, notes, limits", () => {
  it("every light needs a token; carrier and note are trimmed and capped", () => {
    const t = setup();
    expect(() => t.add("torch", "")).toThrow(TypeError);
    expect(() => t.add("candle" as L.LightKind)).toThrow(TypeError);
    t.add("torch", "aria", "  Aria  ", "  from the shrine ");
    expect(t.light(0)).toMatchObject({ tokenId: "aria", carrier: "Aria", note: "from the shrine" });
    t.do((s, now) => L.editNote(s, now, "light-1", "x".repeat(100)));
    expect(t.light(0).note).toHaveLength(L.MAX_NOTE);
  });

  it("one lit light per token: a second throws until the first goes out; other tokens aren't limited", () => {
    const t = setup();
    t.add("torch", "aria", "Aria");
    expect(() => t.add("lantern", "aria")).toThrow(L.AlreadyLitError);
    expect(() => t.add("lantern", "aria")).toThrow("Aria already carries a lit torch");
    expect(t.s.lights).toHaveLength(1);
    t.add("torch", "borin");
    t.do((s, now) => L.putOut(s, now, "light-1"));
    t.add("lantern", "aria");
    expect(L.litOn(t.s, "aria")?.kind).toBe("lantern");
    // Turning the old torch back on is checked too.
    expect(() => t.do((s, now) => L.relight(s, now, "light-1"))).toThrow(L.AlreadyLitError);
  });

  it("swap puts out the token's light and lights the new one, in one change", () => {
    let n = 0;
    const newId = () => `l${++n}`;
    let s = L.addLight(L.emptyLights(), T0, newId, { kind: "torch", tokenId: "aria" });
    s = L.swapLight(s, T0 + 10 * MIN, newId, { kind: "lantern", tokenId: "aria" });
    expect(s.lights.map((l) => [l.kind, l.status])).toEqual([
      ["torch", "out"],
      ["lantern", "lit"],
    ]);
    expect(L.remaining(s.lights[0], T0 + 10 * MIN)).toBe(50 * MIN);
  });

  it(`stops at ${L.MAX_LIGHTS} lights`, () => {
    const t = setup("separate");
    for (let i = 0; i < L.MAX_LIGHTS; i++) t.add("torch", `t${i}`);
    expect(() => t.add("torch", "one-more")).toThrow(RangeError);
  });

  it("renaming the token renames its lights", () => {
    const t = setup();
    t.add("torch", "aria", "Aria");
    t.do((s, now) => L.putOut(s, now, "light-1"));
    t.add("lantern", "aria", "Aria");
    t.add("torch", "borin", "Borin");
    t.do((s) => L.renameCarrier(s, "aria", "Brother Aldo"));
    expect(t.s.lights.map((l) => l.carrier)).toEqual(["Brother Aldo", "Brother Aldo", "Borin"]);
    const same = t.s;
    t.do((s) => L.renameCarrier(s, "aria", "Brother Aldo"));
    expect(t.s).toBe(same);
  });

  it("remove all keeps the rules and Pause", () => {
    const t = setup("separate");
    t.add("torch");
    t.add("lantern");
    t.do(L.pause);
    t.do(L.removeAll);
    expect(t.s).toMatchObject({ lights: [], lightingRule: "separate", paused: true });
    const empty = t.s;
    t.do(L.removeAll);
    expect(t.s).toBe(empty);
  });

  it("remove; unknown ids throw; Time passes takes 1 ms to 24 h", () => {
    const t = setup();
    t.add("torch");
    expect(() => t.do((s, now) => L.putOut(s, now, "nope"))).toThrow(/Unknown light/);
    expect(() => t.do((s, now) => L.timePasses(s, now, 0))).toThrow(RangeError);
    expect(() => t.do((s, now) => L.timePasses(s, now, 25 * 60 * MIN))).toThrow(RangeError);
    t.do((s, now) => L.removeLight(s, now, "light-1"));
    expect(t.status()).toBe("none");
  });
});

describe("manual fixes", () => {
  it("Resume (default): a put-out light continues its own time, even with Ride along", () => {
    const t = setup("rideAlong");
    t.add("torch", "a");
    t.advance(10 * MIN);
    t.do((s, now) => L.putOut(s, now, "light-1"));
    t.add("torch", "b");
    t.advance(30 * MIN);
    t.do((s, now) => L.relight(s, now, "light-1"));
    expect(t.left(0)).toBe(50 * MIN);
  });

  it("Treat as newly lit: a put-out light rides along like a new one", () => {
    const t = setup("rideAlong");
    t.do((s) => L.setRelightRule(s, "lightingRule"));
    t.add("torch", "a");
    t.advance(10 * MIN);
    t.do((s, now) => L.putOut(s, now, "light-1"));
    t.add("torch", "b");
    t.advance(30 * MIN);
    t.do((s, now) => L.relight(s, now, "light-1"));
    expect(t.left(0)).toBe(30 * MIN);
  });

  it("a burned-out light relights as the same light, keeping carrier and note", () => {
    const t = setup();
    t.add("torch", "aria", "Aria", "blessed");
    t.do((s, now) => L.timePasses(s, now, 60 * MIN));
    t.do((s, now) => L.relight(s, now, "light-1"));
    expect(t.light(0)).toMatchObject({ status: "lit", carrier: "Aria", note: "blessed", spentAt: null });
    expect(t.left(0)).toBe(60 * MIN);
    expect(t.s.lights).toHaveLength(1);
  });

  it("setting the time corrects any light; a spent one comes back out", () => {
    const t = setup();
    t.add("torch");
    t.advance(20 * MIN);
    t.do((s, now) => L.setRemaining(s, now, "light-1", 55 * MIN));
    expect(t.left(0)).toBe(55 * MIN);
    t.advance(5 * MIN);
    expect(t.left(0)).toBe(50 * MIN);
    t.do((s, now) => L.timePasses(s, now, 50 * MIN));
    t.do((s, now) => L.setRemaining(s, now, "light-1", 12 * MIN));
    expect(t.light(0).status).toBe("out");
    expect(t.left(0)).toBe(12 * MIN);
    expect(() => t.do((s, now) => L.setRemaining(s, now, "light-1", 61 * MIN))).toThrow(RangeError);
    expect(() => t.do((s, now) => L.setRemaining(s, now, "light-1", 0))).toThrow(RangeError);
  });

  it("msToNextBurnOut: the soonest lit light; none while paused", () => {
    const t = setup("separate");
    expect(L.msToNextBurnOut(t.s, t.now())).toBeNull();
    t.add("torch");
    t.advance(15 * MIN);
    t.add("lightSpell");
    expect(L.msToNextBurnOut(t.s, t.now())).toBe(45 * MIN);
    t.do(L.pause);
    expect(L.msToNextBurnOut(t.s, t.now())).toBeNull();
  });
});

describe("time entry", () => {
  it("Time passes reads minutes, hours, both, h:mm and a bare number (minutes)", () => {
    const cases: [string, number][] = [
      ["10m", 10],
      ["10 min", 10],
      ["90", 90],
      ["1h", 60],
      ["1.5h", 90],
      ["1h30m", 90],
      ["1h 30", 90],
      ["1:30", 90],
      [" 2 HOURS ", 120],
    ];
    for (const [raw, min] of cases) expect(L.parseTimeEntry(raw), raw).toBe(min * MIN);
  });

  it("rejects nonsense, zero and more than a day", () => {
    for (const bad of ["", "abc", "0", "0m", "-5", "1:75", "25h", "1441", "10s", "1h-30"]) expect(L.parseTimeEntry(bad), bad).toBeNull();
  });

  it("setting a time reads like the countdown: mm:ss and h:mm:ss", () => {
    expect(L.parseClockEntry("42:15")).toBe((42 * 60 + 15) * 1000);
    expect(L.parseClockEntry("1:00:00")).toBe(60 * MIN);
    expect(L.parseClockEntry("30m")).toBe(30 * MIN);
    expect(L.parseClockEntry("45")).toBe(45 * MIN);
    for (const bad of ["0:00", "42:75", "1:2:3", "abc", ""]) expect(L.parseClockEntry(bad), bad).toBeNull();
  });

  it("formats countdowns, rounding up so 0:00 means out", () => {
    expect(L.formatRemaining(42 * MIN + 15_000)).toBe("42:15");
    expect(L.formatRemaining(8 * 60 * MIN)).toBe("8:00:00");
    expect(L.formatRemaining(59_001)).toBe("1:00");
    expect(L.formatRemaining(-5)).toBe("0:00");
  });
});

describe("parsing the room's copy", () => {
  it("keeps what's valid and drops the rest", () => {
    const good = { id: "a", kind: "torch", tokenId: "t", status: "lit", remainingMs: 30 * MIN, endsAt: T0, carrier: "Aria", note: "", shuttered: false, spentAt: null };
    const s = L.parseLights({
      paused: true,
      lightingRule: "separate",
      relightRule: "lightingRule",
      lights: [good, { ...good, id: "a" }, { ...good, id: "b", kind: "candle" }, { ...good, id: "c", tokenId: "" }, "junk", null],
    });
    expect(s).toMatchObject({ paused: true, lightingRule: "separate", relightRule: "lightingRule" });
    expect(s.lights.map((l) => l.id)).toEqual(["a"]);
  });

  it("clamps times, drops a shutter on anything but a lantern, and reads garbage as empty", () => {
    const s = L.parseLights({
      lights: [{ id: "a", kind: "torch", tokenId: "t", status: "out", remainingMs: 999 * MIN, shuttered: true, carrier: "x".repeat(99), note: 7 }],
    });
    expect(s.lights[0]).toMatchObject({ remainingMs: 60 * MIN, shuttered: false, note: "" });
    expect(s.lights[0].carrier).toHaveLength(L.MAX_CARRIER);
    expect(L.parseLights("nope")).toEqual(L.emptyLights());
  });

  it("a second lit light on one token reads as out", () => {
    const lit = (id: string) => ({ id, kind: "torch", tokenId: "t", status: "lit", remainingMs: 60 * MIN, endsAt: T0 + 60 * MIN });
    expect(L.parseLights({ lights: [lit("a"), lit("b")] }).lights.map((l) => l.status)).toEqual(["lit", "out"]);
  });

  it(`reads at most ${L.MAX_LIGHTS} lights`, () => {
    const lights = Array.from({ length: 20 }, (_, i) => ({ id: `l${i}`, kind: "torch", tokenId: `t${i}`, status: "out" }));
    expect(L.parseLights({ lights }).lights).toHaveLength(L.MAX_LIGHTS);
  });
});
