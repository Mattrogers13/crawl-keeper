import { describe, it, expect } from "vitest";

import { applyHpText, inheritHp, parseTracker, setHp, setMonster, emptyTracker, add, type Tracker } from "./tracker";

const withMonsters = (hps: Record<string, { cur: number; max: number } | undefined>): Tracker => {
  let t = add(emptyTracker(), Object.keys(hps));
  t = setMonster(t, Object.keys(hps), true);
  return { ...t, entries: t.entries.map((e) => (e.id in hps ? { ...e, hp: hps[e.id] } : e)) };
};
const hpOf = (t: Tracker, id: string) => t.entries.find((e) => e.id === id)?.hp;

describe("applyHpText", () => {
  it("a plain number starts HP full, then sets the current", () => {
    expect(applyHpText(undefined, "12")).toEqual({ cur: 12, max: 12 });
    expect(applyHpText({ cur: 3, max: 12 }, "8")).toEqual({ cur: 8, max: 12 });
    // Over the max: the max was typed wrong, both become it.
    expect(applyHpText({ cur: 3, max: 12 }, "20")).toEqual({ cur: 20, max: 20 });
  });
  it("+ and - heal and hurt, within 0 and the max", () => {
    expect(applyHpText({ cur: 8, max: 12 }, "-3")).toEqual({ cur: 5, max: 12 });
    expect(applyHpText({ cur: 8, max: 12 }, "−3")).toEqual({ cur: 5, max: 12 });
    expect(applyHpText({ cur: 8, max: 12 }, "+9")).toEqual({ cur: 12, max: 12 });
    expect(applyHpText({ cur: 2, max: 12 }, "-30")).toEqual({ cur: 0, max: 12 });
  });
  it("arithmetic on the shown number: 10-3", () => {
    expect(applyHpText({ cur: 12, max: 12 }, "10-3")).toEqual({ cur: 7, max: 12 });
    expect(applyHpText({ cur: 5, max: 12 }, "7+9")).toEqual({ cur: 12, max: 12 });
    expect(applyHpText({ cur: 5, max: 12 }, "3-9")).toEqual({ cur: 0, max: 12 });
  });
  it("+ and - without HP do nothing", () => {
    expect(applyHpText(undefined, "-3")).toBeUndefined();
  });
  it("/max and cur/max", () => {
    expect(applyHpText(undefined, "/12")).toEqual({ cur: 12, max: 12 });
    expect(applyHpText({ cur: 9, max: 12 }, "/6")).toEqual({ cur: 6, max: 6 });
    expect(applyHpText({ cur: 4, max: 12 }, "/20")).toEqual({ cur: 4, max: 20 });
    expect(applyHpText(undefined, "5/12")).toEqual({ cur: 5, max: 12 });
    expect(applyHpText(undefined, "20/12")).toEqual({ cur: 12, max: 12 });
  });
  it("empty clears; junk is refused", () => {
    expect(applyHpText({ cur: 1, max: 2 }, "  ")).toBeNull();
    for (const bad of ["abc", "1.5", "0", "/0", "1000", "-", "1/2/3"]) expect(applyHpText(undefined, bad), bad).toBeUndefined();
  });
});

describe("setHp", () => {
  it("applies the text to each monster's own HP; dead ones are left alone", () => {
    let t = withMonsters({ m1: { cur: 10, max: 10 }, m2: { cur: 4, max: 10 }, m3: { cur: 7, max: 10 } });
    t = { ...t, entries: t.entries.map((e) => (e.id === "m3" ? { ...e, dead: true } : e)) };
    const out = setHp(t, ["m1", "m2", "m3"], "-5");
    expect(hpOf(out, "m1")).toEqual({ cur: 5, max: 10 });
    expect(hpOf(out, "m2")).toEqual({ cur: 0, max: 10 });
    expect(hpOf(out, "m3")).toEqual({ cur: 7, max: 10 });
    // Reaching 0 kills; the dead one's HP stays.
    expect(out.entries.filter((e) => e.dead).map((e) => e.id)).toEqual(["m2", "m3"]);
  });
  it("returns the same object when nothing changes", () => {
    const t = withMonsters({ m1: { cur: 10, max: 10 } });
    expect(setHp(t, ["m1"], "10")).toBe(t);
  });
  it("players never get HP", () => {
    const t = add(emptyTracker(), ["p1"]);
    expect(setHp(t, ["p1"], "10")).toBe(t);
  });
});

describe("inheritHp", () => {
  it("a monster marked later starts at the max of its kind", () => {
    let t = withMonsters({ m1: { cur: 3, max: 12 }, m2: undefined, m3: undefined });
    t = inheritHp(t, ["m2"], () => "zombie");
    expect(hpOf(t, "m2")).toEqual({ cur: 12, max: 12 });
    expect(hpOf(t, "m3")).toBeUndefined();
  });
  it("another kind, or an HP already set, is left alone", () => {
    const t = withMonsters({ m1: { cur: 3, max: 12 }, m2: undefined, m3: { cur: 1, max: 2 } });
    const kind = (id: string) => (id === "m2" ? "ghoul" : "zombie");
    const out = inheritHp(t, ["m2", "m3"], kind);
    expect(hpOf(out, "m2")).toBeUndefined();
    expect(hpOf(out, "m3")).toEqual({ cur: 1, max: 2 });
  });
});

describe("HP in the saved doc", () => {
  it("round-trips for monsters, is clamped, and is dropped for players and junk", () => {
    const base = { id: "x", roll: null, note: "", dead: false, marker: false };
    const parse = (e: object) => parseTracker({ entries: [{ ...base, ...e }] }).entries.find((x) => x.id === "x");
    expect(parse({ monster: true, hp: { cur: 5, max: 12 } })?.hp).toEqual({ cur: 5, max: 12 });
    expect(parse({ monster: true, hp: { cur: 50, max: 12 } })?.hp).toEqual({ cur: 12, max: 12 });
    expect(parse({ monster: true, hp: { cur: -1, max: 12 } })?.hp).toBeUndefined();
    expect(parse({ monster: true, hp: { cur: 1, max: 0 } })?.hp).toBeUndefined();
    expect(parse({ monster: true, hp: "lots" })?.hp).toBeUndefined();
    expect(parse({ monster: false, hp: { cur: 5, max: 12 } })?.hp).toBeUndefined();
  });
  it("marking a monster as a player drops its HP", () => {
    const t = withMonsters({ m1: { cur: 5, max: 12 } });
    expect(hpOf(setMonster(t, ["m1"], false), "m1")).toBeUndefined();
  });
});
