import { describe, it, expect } from "vitest";

import {
  GM_ENTRY,
  MAX_ENTRIES,
  NOTE_MAX,
  add,
  emptyTracker,
  moveTo,
  next,
  parseTracker,
  playerView,
  previous,
  prune,
  remove,
  setDead,
  setNote,
  setRoll,
  sortByRoll,
  removeMonsters,
  setMarker,
  setMonster,
  resetRounds,
  toCombat,
  toCrawl,
  toggle,
  turnOrder,
  type Tracker,
} from "./tracker";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";
import { emptyCrawl } from "./crawl";

// Ids starting with "m" are monsters (they take no roll).
const tracker = (rolls: Record<string, number | null>, current: string | null = null, round = 0, dead: string[] = []): Tracker => ({
  entries: Object.entries(rolls).map(([id, roll]) => {
    const monster = id.startsWith("m");
    return { id, roll: monster ? null : roll, note: "", dead: dead.includes(id), monster, marker: !monster && id !== GM_ENTRY };
  }),
  phase: "crawl",
  current,
  round,
  crawl: emptyCrawl(),
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
      { id: "a", roll: 12, note: "hi", dead: false, monster: false, marker: true },
      { id: "b", roll: null, note: "", dead: false, monster: false, marker: true },
      { id: GM_ENTRY, roll: null, note: "", dead: false, monster: false, marker: false },
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

  it("caps notes and drops a current turn that isn't in the list (the round count stays)", () => {
    const t = parseTracker({ entries: [{ id: "a", note: "x".repeat(500) }], current: "ghost", round: 3 });
    expect(t.entries[0].note).toHaveLength(NOTE_MAX);
    expect(t.current).toBeNull();
    expect(t.round).toBe(3);
  });

  it("reads the phase", () => {
    const combat = parseTracker({ entries: [{ id: "a" }], phase: "combat", current: "a", round: 4 });
    expect(combat).toMatchObject({ phase: "combat", current: "a", round: 4 });
    expect(parseTracker({ entries: [], phase: "nope" }).phase).toBe("crawl");
  });

  it("a turn needs a round", () => {
    expect(parseTracker({ entries: [{ id: "a" }], phase: "combat", current: "a", round: 0 }).current).toBeNull();
  });

  it("keeps dead only as true, never on the GM row, and drops a dead current turn", () => {
    const t = parseTracker({
      entries: [{ id: "a", dead: true }, { id: "b", dead: "yes" }, { id: GM_ENTRY, dead: true }],
      current: "a",
      round: 2,
    });
    expect(t.entries.map((e) => e.dead)).toEqual([true, false, false]);
    expect([t.current, t.round]).toEqual([null, 2]);
  });
});

describe("turn order", () => {
  it("the list is the order", () => {
    expect(ids(turnOrder(tracker({ a: 3, b: 18, gm: 10 })))).toEqual(["a", "b", "gm"]);
  });

  it("next advances and the round ticks when the order wraps", () => {
    let t = next(tracker({ a: 3, b: 18, gm: 10 }));
    expect([t.current, t.round]).toEqual(["a", 1]);
    t = next(t);
    expect(t.current).toBe("b");
    t = next(next(t));
    expect([t.current, t.round]).toEqual(["a", 2]);
  });

  it("between rounds, next starts the next round at the top", () => {
    expect(next(tracker({ a: 1, gm: 2 }, null, 5))).toMatchObject({ current: "a", round: 6 });
  });

  it("previous steps back across rounds but not before round 1", () => {
    expect(previous(tracker({ a: 1, gm: 2 }))).toEqual(tracker({ a: 1, gm: 2 }));
    let t = next(tracker({ a: 1, gm: 2 }));
    expect(previous(t)).toBe(t);
    t = next(next(t));
    expect([t.current, t.round]).toEqual(["a", 2]);
    t = previous(t);
    expect([t.current, t.round]).toEqual(["gm", 1]);
  });
});

describe("crawl and combat", () => {
  it("one round count runs through both; a switch ends the round", () => {
    let t = next(next(next(tracker({ a: 1, gm: 2 }))));
    expect([t.current, t.round]).toEqual(["a", 2]);
    t = toCombat(t, false);
    expect(t).toMatchObject({ phase: "combat", current: null, round: 2 });
    t = next(t);
    expect(t).toMatchObject({ current: "a", round: 3 });
    t = next(next(t));
    expect(t).toMatchObject({ current: "a", round: 4 });
    expect(previous(previous(t))).toMatchObject({ current: "a", round: 3 });
    t = toCrawl(t);
    expect(t).toMatchObject({ phase: "crawl", current: null, round: 4 });
    expect(next(t)).toMatchObject({ current: "a", round: 5 });
  });

  it("crawl rounds count toward encounter checks; combat rounds don't", () => {
    let t = next(next(next(tracker({ a: 1, gm: 2 }))));
    expect([t.round, t.crawl.crawlRounds]).toEqual([2, 2]);
    t = next(next(toCombat(t, false)));
    expect([t.round, t.crawl.crawlRounds]).toEqual([3, 2]);
    t = next(toCrawl(t));
    expect([t.round, t.crawl.crawlRounds]).toEqual([4, 3]);
    expect(previous(next(t))).toMatchObject({ round: 4 });
    expect(previous(t).crawl.crawlRounds).toBe(2);
    expect(resetRounds(t).crawl.crawlRounds).toBe(0);
  });

  it("keeps the rolls unless told to clear them", () => {
    const t = tracker({ a: 12, b: 5, gm: 9 });
    expect(toCombat(t, false).entries).toBe(t.entries);
    expect(toCombat(t, true).entries.map((e) => e.roll)).toEqual([null, null, null]);
  });

  it("the combat order and rolls carry on into the crawl", () => {
    let t = toCombat(tracker({ a: 12, b: 5, gm: 9 }), true);
    t = sortByRoll(setRoll(setRoll(t, "b", 20), GM_ENTRY, 1));
    t = toCrawl(t);
    expect(ids(t.entries)).toEqual(["b", "gm", "a"]);
    expect(t.entries.map((e) => e.roll)).toEqual([20, 1, null]);
  });

  it("reset rounds: the count to 0, no turn; order, rolls and phase stay", () => {
    const t = { ...toCombat(tracker({ a: 4, gm: 9 }, "a", 6), false), current: "gm" };
    expect(resetRounds(t)).toMatchObject({ phase: "combat", current: null, round: 0, entries: t.entries });
    const fresh = tracker({ a: 1 });
    expect(resetRounds(fresh)).toBe(fresh);
  });

  it("switching to the phase you're in changes nothing", () => {
    const t = tracker({ a: 1 }, "a", 3);
    expect(toCrawl(t)).toBe(t);
    const c = toCombat(t, true);
    expect(toCombat(c, false)).toBe(c);
  });

  it("clears rolls on combat by default", () => {
    expect(DEFAULT_SETTINGS.clearRollsOnCombat).toBe(true);
  });
});

describe("monsters", () => {
  it("in combat, take their turns right after the GM row, in list order; dead ones skipped", () => {
    const t = { ...tracker({ a: 15, gm: 10, b: 4, m1: null, m2: null, m3: null }, null, 0, ["m2"]), phase: "combat" as const };
    expect(ids(turnOrder(t))).toEqual(["a", "gm", "m1", "m3", "b"]);
    let s = next(t);
    const seen = [];
    for (let i = 0; i < 6; i++) {
      seen.push(s.current);
      s = next(s);
    }
    expect(seen).toEqual(["a", "gm", "m1", "m3", "b", "a"]);
  });

  it("while crawling, the GM turn covers them: no turns of their own", () => {
    const t = tracker({ a: 15, gm: 10, b: 4, m1: null }, "gm", 2);
    expect(ids(turnOrder(t))).toEqual(["a", "gm", "b"]);
    expect(next(t).current).toBe("b");
  });

  it("parse keeps monsters after everyone else, with no roll; the GM row is never one", () => {
    const t = parseTracker({
      entries: [{ id: "m1", monster: true, roll: 18 }, { id: "a", roll: 3 }, { id: GM_ENTRY, monster: true }],
    });
    expect(t.entries.map((e) => [e.id, e.monster, e.roll])).toEqual([
      ["a", false, 3],
      [GM_ENTRY, false, null],
      ["m1", true, null],
    ]);
  });

  it("sorting moves players and the GM row; monsters keep their order", () => {
    const t = sortByRoll(tracker({ a: 3, gm: 12, b: 9, m2: null, m1: null }));
    expect(ids(t.entries)).toEqual(["gm", "b", "a", "m2", "m1"]);
  });

  it("remove monsters: all of them, nothing else; none to remove keeps the object", () => {
    const t = tracker({ a: 5, gm: 3, m1: null, m2: null });
    expect(ids(removeMonsters(t).entries)).toEqual(["a", "gm"]);
    const none = tracker({ a: 5, gm: 3 });
    expect(removeMonsters(none)).toBe(none);
  });

  it("monsters take no roll", () => {
    const t = tracker({ gm: 1, m1: null });
    expect(setRoll(t, "m1", 12)).toBe(t);
  });

  it("right-click adds everyone as players and allies, before the monsters", () => {
    const t = toggle(tracker({ a: 14, gm: 9, m1: null }), ["x"]);
    expect(t.entries.map((e) => [e.id, e.monster])).toEqual([["a", false], [GM_ENTRY, false], ["x", false], ["m1", true]]);
  });

  it("marking: a monster loses its roll and acts last in the GM turn; and back", () => {
    let t = setMonster(tracker({ a: 14, gm: 9, m1: null }), ["a"], true);
    expect(t.entries.map((e) => [e.id, e.monster, e.roll])).toEqual([
      [GM_ENTRY, false, 9],
      ["m1", true, null],
      ["a", true, null],
    ]);
    t = setMonster(t, ["a"], false);
    expect(t.entries.map((e) => [e.id, e.monster])).toEqual([[GM_ENTRY, false], ["a", false], ["m1", true]]);
    expect(setMonster(t, ["a"], false)).toBe(t);
    expect(setMonster(t, [GM_ENTRY], true)).toBe(t);
    expect(setMonster(t, ["ghost"], true)).toBe(t);
  });

  it("batch: several switch at once, keeping their order; the marker takes the new kind's default", () => {
    const t = setMonster(tracker({ a: 1, b: 2, c: 3, gm: 4 }), ["c", "a"], true);
    expect(t.entries.map((e) => [e.id, e.monster, e.marker])).toEqual([
      ["b", false, true],
      [GM_ENTRY, false, false],
      ["a", true, false],
      ["c", true, false],
    ]);
  });

  it("switching the current token's kind keeps its turn", () => {
    const combat = { ...tracker({ a: 14, gm: 9, b: 3 }, "a", 1), phase: "combat" as const };
    const t = setMonster(combat, ["a"], true);
    expect(t.current).toBe("a");
    expect(ids(turnOrder(t))).toEqual(["gm", "a", "b"]);
  });
});

describe("turn marker per token", () => {
  it("parse: kept as given, else on for players and allies, off for monsters; never the GM row", () => {
    const t = parseTracker({
      entries: [{ id: "p" }, { id: "q", marker: false }, { id: "m", monster: true }, { id: "n", monster: true, marker: true }, { id: GM_ENTRY, marker: true }],
    });
    expect(t.entries.map((e) => [e.id, e.marker])).toEqual([
      ["p", true],
      ["q", false],
      [GM_ENTRY, false],
      ["m", false],
      ["n", true],
    ]);
  });

  it("set for one or many; no change keeps the object", () => {
    const t = tracker({ a: 1, gm: 2, m1: null, m2: null });
    const on = setMarker(t, ["m1", "m2", GM_ENTRY], true);
    expect(on.entries.map((e) => e.marker)).toEqual([true, false, true, true]);
    expect(setMarker(on, ["m1"], true)).toBe(on);
  });

  it("batch dead: several at once; the turn passes once", () => {
    const t = setDead(tracker({ a: 1, b: 2, c: 3, gm: 4 }, "a", 1), ["a", "b"], true);
    expect(t.entries.map((e) => e.dead)).toEqual([true, true, false, false]);
    expect(t.current).toBe("c");
  });
});

describe("playerView", () => {
  it("drops hidden tokens; a hidden token's turn shows as the GM row's", () => {
    const t = tracker({ a: 5, gm: 3, m1: null, m2: null }, "m2", 1);
    const view = playerView(t, (id) => id !== "m2");
    expect(ids(view.entries)).toEqual(["a", "gm", "m1"]);
    expect(view.current).toBe(GM_ENTRY);
    expect(playerView(t, () => true).current).toBe("m2");
    expect(playerView({ ...t, current: null }, () => false).current).toBeNull();
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
    t = setDead(t, ["b"], true);
    expect([t.current, t.round]).toEqual(["gm", 2]);
    expect(next(t)).toMatchObject({ current: "a", round: 3 });
    t = setDead(t, ["b"], false);
    expect(next(next(t)).current).toBe("b");
  });

  it("the GM row can't die; no-ops keep the object", () => {
    const t = tracker({ a: 1, gm: 2 });
    expect(setDead(t, [GM_ENTRY], true)).toBe(t);
    expect(setDead(t, ["a"], false)).toBe(t);
    expect(setDead(t, ["missing"], true)).toBe(t);
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

  it("moves an entry to another's place, within its own group only", () => {
    const t = tracker({ a: 1, b: 2, c: 3, gm: 4, m1: null, m2: null });
    expect(ids(moveTo(t, "a", "c").entries)).toEqual(["b", "c", "a", "gm", "m1", "m2"]);
    expect(ids(moveTo(t, "gm", "a").entries)).toEqual(["gm", "a", "b", "c", "m1", "m2"]);
    expect(ids(moveTo(t, "m2", "m1").entries)).toEqual(["a", "b", "c", "gm", "m2", "m1"]);
    expect(moveTo(t, "m1", "a")).toBe(t);
    expect(moveTo(t, "a", "m1")).toBe(t);
    expect(moveTo(t, "b", "b")).toBe(t);
    expect(moveTo(t, "ghost", "a")).toBe(t);
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
  // About 12 kB passed in a real room (PR 1); this worst case, with a full
  // crawl (10 exploded dice and an undo), is about 12.4 kB.
  it("a full tracker in combat stays under 12.5 kB", () => {
    const id = (i: number) => `${"x".repeat(30)}-${i}`; // Owlbear ids are shorter
    const full = parseTracker({
      entries: Array.from({ length: MAX_ENTRIES }, (_, i) => ({
        id: id(i),
        roll: -99,
        note: "n".repeat(NOTE_MAX),
        dead: i > 1,
        monster: i > 0,
      })),
      phase: "combat",
      current: id(0),
      round: 9999,
      crawl: {
        danger: "deadly",
        dark: true,
        clock: 20,
        crawlRounds: 9999,
        lastCheck: 9999,
        last: { kind: "clock", dice: Array(10).fill(8), sides: 8, before: 20, after: 20, encounter: true },
        undo: { danger: "deadly", dark: true, clock: 20, crawlRounds: 9999, lastCheck: 9999 },
      },
    });
    expect(full.crawl.last?.dice).toHaveLength(10);
    expect(new Blob([JSON.stringify(full)]).size).toBeLessThan(12_500);
  });
});

describe("parseSettings", () => {
  it("defaults anything malformed", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      encounterMode: "standard",
      hideClock: false,
      showDanger: false,
      hideRound: false,
      clearRollsOnCombat: true,
      showMarker: true,
      selectOnTurn: true,
    });
    const off = { encounterMode: "clock", hideClock: true, showDanger: true, hideRound: true, clearRollsOnCombat: false, showMarker: false, selectOnTurn: false };
    expect(parseSettings(off)).toEqual(off);
    // Rooms saved while Table order existed keep working.
    expect(parseSettings({ orderMode: "table", hideRound: "yes", clearRollsOnCombat: "no", showMarker: 0 })).toEqual(DEFAULT_SETTINGS);
  });
});
