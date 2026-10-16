import { describe, it, expect } from "vitest";

import {
  GM_ENTRY,
  MAX_ENTRIES,
  NOTE_MAX,
  add,
  emptyTracker,
  move,
  next,
  parseTracker,
  previous,
  prune,
  remove,
  setDead,
  setNote,
  setRoll,
  sortByRoll,
  start,
  toggle,
  turnOrder,
  type Tracker,
} from "./tracker";
import { parseSettings } from "./settings";

const tracker = (rolls: Record<string, number | null>, current: string | null = null, round = 0, dead: string[] = []): Tracker => ({
  entries: Object.entries(rolls).map(([id, roll]) => ({ id, roll, note: "", dead: dead.includes(id) })),
  current,
  round,
});
const ids = (t: { id: string }[]) => t.map((e) => e.id);

describe("parseTracker", () => {
  it("gives an empty tracker with the GM row for missing or junk data", () => {
    for (const raw of [undefined, null, 5, "x", [], { entries: "nope" }]) {
      expect(parseTracker(raw)).toEqual(emptyTracker());
    }
  });

  it("keeps well-formed entries and drops malformed ones and duplicates", () => {
    const t = parseTracker({
      entries: [
        { id: "a", roll: 12, note: "hi" },
        { id: "a", roll: 3 },
        { id: 7 },
        null,
        { id: "b", roll: 1.5, note: 9 },
        { id: GM_ENTRY, roll: 400 },
      ],
      current: "b",
      round: 2,
    });
    expect(t.entries).toEqual([
      { id: "a", roll: 12, note: "hi", dead: false },
      { id: "b", roll: null, note: "", dead: false },
      { id: GM_ENTRY, roll: null, note: "", dead: false },
    ]);
    expect(t.current).toBe("b");
    expect(t.round).toBe(2);
  });

  it("adds the GM row when it's missing, even at the cap", () => {
    const entries = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => ({ id: `t${i}`, roll: 1 }));
    const t = parseTracker({ entries });
    expect(t.entries).toHaveLength(MAX_ENTRIES);
    expect(t.entries.at(-1)!.id).toBe(GM_ENTRY);
  });

  it("caps notes and drops a current turn that isn't in the list", () => {
    const t = parseTracker({ entries: [{ id: "a", note: "x".repeat(500) }], current: "ghost", round: 3 });
    expect(t.entries[0].note).toHaveLength(NOTE_MAX);
    expect(t.current).toBeNull();
    expect(t.round).toBe(0);
  });

  it("keeps dead only as true, never on the GM row, and drops a dead current turn", () => {
    const t = parseTracker({
      entries: [{ id: "a", dead: true }, { id: "b", dead: "yes" }, { id: GM_ENTRY, dead: true }],
      current: "a",
      round: 2,
    });
    expect(t.entries.map((e) => e.dead)).toEqual([true, false, false]);
    expect([t.current, t.round]).toEqual([null, 0]);
  });
});

describe("turn order", () => {
  it("the list is the order", () => {
    expect(ids(turnOrder(tracker({ a: 3, b: 18, gm: 10 })))).toEqual(["a", "b", "gm"]);
  });



  it("next advances and the round ticks when the order wraps", () => {
    let t = start(tracker({ a: 3, b: 18, gm: 10 }));
    expect([t.current, t.round]).toEqual(["a", 1]);
    t = next(t);
    expect(t.current).toBe("b");
    t = next(next(t));
    expect([t.current, t.round]).toEqual(["a", 2]);
  });

  it("next on a stopped tracker starts it", () => {
    expect(next(tracker({ a: 1, gm: 2 }))).toMatchObject({ current: "a", round: 1 });
  });

  it("previous steps back across rounds but not before round 1", () => {
    let t = start(tracker({ a: 1, gm: 2 }));
    expect(previous(t)).toBe(t);
    t = next(next(t));
    expect([t.current, t.round]).toEqual(["a", 2]);
    t = previous(t);
    expect([t.current, t.round]).toEqual(["gm", 1]);
  });
});

describe("dead", () => {
  it("dead entries keep their seat but get no turns", () => {
    const t = tracker({ a: 3, b: 18, gm: 10, c: 5 }, null, 0, ["b"]);
    expect(ids(turnOrder(t))).toEqual(["a", "gm", "c"]);
    expect(ids(t.entries)).toEqual(["a", "b", "gm", "c"]);
  });

  it("killing the current entry passes the turn; reviving gives turns back", () => {
    let t = tracker({ a: 1, b: 2, gm: 3 }, "b", 2);
    t = setDead(t, "b", true);
    expect([t.current, t.round]).toEqual(["gm", 2]);
    expect(next(t)).toMatchObject({ current: "a", round: 3 });
    t = setDead(t, "b", false);
    expect(next(next(t)).current).toBe("b");
  });

  it("the GM row can't die; no-ops keep the object", () => {
    const t = tracker({ a: 1, gm: 2 });
    expect(setDead(t, GM_ENTRY, true)).toBe(t);
    expect(setDead(t, "a", false)).toBe(t);
    expect(setDead(t, "missing", true)).toBe(t);
  });
});

describe("editing", () => {
  it("adds new ids once, never the GM row, up to the cap", () => {
    const t = add(emptyTracker(), ["x", "x", GM_ENTRY, "y"]);
    expect(ids(t.entries)).toEqual([GM_ENTRY, "x", "y"]);
    expect(add(t, ["x"])).toBe(t);
    const full = add(emptyTracker(), Array.from({ length: 100 }, (_, i) => `t${i}`));
    expect(full.entries).toHaveLength(MAX_ENTRIES);
  });

  it("removing the current entry passes the turn to whoever was next", () => {
    const t = remove(tracker({ a: 1, b: 2, gm: 3 }, "b", 2), ["b"]);
    expect(ids(t.entries)).toEqual(["a", "gm"]);
    expect([t.current, t.round]).toEqual(["gm", 2]);
  });

  it("never removes the GM row", () => {
    const t = tracker({ a: 1, gm: 2 });
    expect(ids(remove(t, [GM_ENTRY, "a"]).entries)).toEqual([GM_ENTRY]);
  });

  it("prune drops tokens that are gone and returns the same object when none are", () => {
    const t = tracker({ a: 1, b: 2, gm: 3 }, "a", 1);
    expect(prune(t, () => true)).toBe(t);
    const p = prune(t, (id) => id !== "a");
    expect(ids(p.entries)).toEqual(["b", "gm"]);
    expect(p.current).toBe("b");
  });

  it("sorts by roll, highest first, unrolled last, ties stable", () => {
    const t = sortByRoll(tracker({ a: 5, b: null, c: 15, d: 5 }));
    expect(ids(t.entries)).toEqual(["c", "a", "d", "b"]);
    expect(sortByRoll(t)).toBe(t);
  });

  it("sets rolls within range and notes within the cap; no-ops keep the object", () => {
    const t = tracker({ a: 1 });
    expect(setRoll(t, "a", 17).entries[0].roll).toBe(17);
    expect(setRoll(t, "a", 1000).entries[0].roll).toBeNull();
    expect(setRoll(t, "a", 1)).toBe(t);
    expect(setNote(t, "a", "y".repeat(300)).entries[0].note).toHaveLength(NOTE_MAX);
    expect(setNote(t, "missing", "x")).toBe(t);
  });

  it("moves an entry up or down, not past the ends", () => {
    const t = tracker({ a: 1, b: 2, c: 3 });
    expect(ids(move(t, "b", -1).entries)).toEqual(["b", "a", "c"]);
    expect(move(t, "a", -1)).toBe(t);
    expect(move(t, "c", 1)).toBe(t);
  });
});

describe("toggle (right-click)", () => {
  it("adds when any clicked token is untracked, removes when all are tracked", () => {
    const t = tracker({ a: 1, gm: 2 });
    expect(ids(toggle(t, ["a", "b"]).entries)).toEqual(["a", "gm", "b"]);
    expect(ids(toggle(t, ["a"]).entries)).toEqual(["gm"]);
    expect(toggle(t, [])).toBe(t);
  });
});

describe("size", () => {
  it("a full tracker stays under 12 kB (scene metadata limit is unverified; see TESTING.md)", () => {
    const full = parseTracker({
      entries: Array.from({ length: MAX_ENTRIES }, (_, i) => ({
        id: `${"x".repeat(30)}-${i}`, // Owlbear ids are shorter
        roll: -99,
        note: "n".repeat(NOTE_MAX),
        dead: true,
      })),
      current: `${"x".repeat(30)}-0`,
      round: 9999,
    });
    expect(new Blob([JSON.stringify(full)]).size).toBeLessThan(12_000);
  });
});

describe("parseSettings", () => {
  it("defaults anything malformed", () => {
    expect(parseSettings(undefined)).toEqual({ hideRound: false });
    expect(parseSettings({ hideRound: true })).toEqual({ hideRound: true });
    // Rooms saved while Table order existed keep working.
    expect(parseSettings({ orderMode: "table", hideRound: "yes" })).toEqual({ hideRound: false });
  });
});
