import { describe, expect, it } from "vitest";

import {
  addEffects,
  AlreadyFocusingError,
  canDie,
  deathRollDue,
  deathTimer,
  dyingOf,
  stabilize,
  startDying,
  stopDying,
  emptyEffects,
  endFocus,
  endFocusOf,
  endingNow,
  focusChecks,
  MAX_EFFECTS,
  NAME_MAX,
  parseEffects,
  playerEffects,
  pruneEffects,
  removeEffects,
  resetEffectRounds,
  restoreEffects,
  setRoundsLeft,
  settle,
  shown,
  statusOf,
  timePassesEffects,
  type Effects,
  type NewEffect,
} from "./effects";
import { add, emptyTracker, GM_ENTRY, next, previous, remove, resetRounds, setDead, setMonster, setRoll, sortByRoll, toCombat, type Tracker } from "./tracker";

// Turn order a, b, GM / Monsters (rolls 15, 10, 5); m is a monster.
const base = (): Tracker => {
  let t = add(emptyTracker(), ["a", "b", "m"]);
  t = setMonster(t, ["m"], true);
  t = setRoll(setRoll(setRoll(t, "a", 15), "b", 10), GM_ENTRY, 5);
  return sortByRoll(t);
};
const steps = (t: Tracker, n: number) => {
  for (let i = 0; i < n; i++) t = next(t);
  return t;
};
// Round 1 is a, b, gm; round 2 starts on the 4th ▶.
const at = (round: number, id: string) => {
  let t = next(base());
  while (t.round !== round || t.current !== id) t = next(t);
  return t;
};

let ids = 0;
const newId = () => `e${++ids}`;
const rand = () => 0.5;
const put = (s: Effects, t: Tracker, input: Partial<NewEffect> & Pick<NewEffect, "duration">) =>
  addEffects(s, t, newId, rand, { name: "Bless", holders: ["a"], ...input });
const left = (s: Effects, t: Tracker, i = 0) => statusOf(s.effects[i], t);

describe("rounds effects", () => {
  it("added on X's turn in round R for N rounds, ends at the start of X's turn in R + N", () => {
    const t = at(3, "a");
    const s = put(emptyEffects(), t, { duration: { kind: "rounds", rounds: 2 } });
    expect(s.effects[0].end).toEqual({ round: 5, at: "a" });
    expect(left(s, t)).toEqual({ state: "active", left: 2 });
    expect(left(s, at(3, GM_ENTRY))).toEqual({ state: "active", left: 2 });
    expect(left(s, at(4, "a"))).toEqual({ state: "active", left: 1 });
    expect(left(s, at(5, "a"))).toEqual({ state: "ended" });
    expect(left(s, at(5, "b"))).toEqual({ state: "gone" });
  });

  it("◀ brings an ended effect back (derived, nothing written)", () => {
    const s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 1 } });
    const ended = at(2, "a");
    expect(left(s, ended).state).toBe("ended");
    expect(left(s, previous(ended))).toEqual({ state: "active", left: 1 });
  });

  it("added between rounds (round 0 or after a phase switch), counts at the round's top: N whole rounds", () => {
    const s = put(emptyEffects(), base(), { duration: { kind: "rounds", rounds: 1 } });
    expect(s.effects[0].end).toEqual({ round: 2, at: null });
    expect(left(s, next(base()))).toEqual({ state: "active", left: 1 });
    expect(left(s, at(1, GM_ENTRY))).toEqual({ state: "active", left: 1 });
    expect(left(s, at(2, "a"))).toEqual({ state: "ended" });
    expect(left(s, at(2, "b"))).toEqual({ state: "gone" });

    const switched = toCombat(at(3, "b"), false);
    const c = put(emptyEffects(), switched, { duration: { kind: "rounds", rounds: 2 } });
    expect(c.effects[0].end).toEqual({ round: 6, at: null });
    expect(left(c, switched)).toEqual({ state: "active", left: 2 });
  });

  it("counts on the row chosen; a turn still to come this round is its first count", () => {
    const s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 1 }, countsOn: "b" });
    expect(s.effects[0].end).toEqual({ round: 1, at: "b" });
    expect(left(s, at(1, "b")).state).toBe("ended");
  });

  it("counted on a monster: the GM / Monsters turn while crawling, its own turn in combat", () => {
    const s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 1 }, countsOn: "m" });
    expect(left(s, at(1, GM_ENTRY)).state).toBe("ended");
    // In combat (round 2) the monster acts after the GM row.
    const fight = next(toCombat(at(1, "a"), false));
    const c = put(emptyEffects(), fight, { duration: { kind: "rounds", rounds: 1 }, countsOn: "m" });
    const gmTurn = steps(fight, 2);
    expect(gmTurn.current).toBe(GM_ENTRY);
    expect(left(c, gmTurn)).toEqual({ state: "active", left: 1 });
    expect(left(c, next(gmTurn)).state).toBe("ended");
  });

  it("a dead counting row's turn passes to the next living row; a removed one counts at the top", () => {
    const s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 1 } });
    const deadA = (t: Tracker) => setDead(t, ["a"], true);
    expect(left(s, deadA(at(1, GM_ENTRY)))).toEqual({ state: "active", left: 1 });
    expect(left(s, deadA(at(2, "b"))).state).toBe("ended");
    const gone = remove(at(1, "b"), ["a"]);
    expect(left(s, gone)).toEqual({ state: "active", left: 1 });
    expect(left(s, remove(at(2, "b"), ["a"])).state).toBe("ended");
  });

  it("rolls the dice once for every holder added together", () => {
    const t = at(1, "a");
    let rolls = 0;
    const s = addEffects(emptyEffects(), t, newId, () => (rolls++, 0.99), {
      name: "Web",
      holders: ["a", "b"],
      duration: { kind: "rounds", dice: "2d4" },
    });
    expect(rolls).toBe(2);
    expect(s.effects.map((e) => [e.holder, e.rounds, e.dice])).toEqual([
      ["a", 8, "2d4"],
      ["b", 8, "2d4"],
    ]);
    expect(s.effects[0].end).toEqual(s.effects[1].end);
  });

  it("Reset rounds keeps each effect's rounds left; ended ones go", () => {
    let s = put(emptyEffects(), at(3, "b"), { duration: { kind: "rounds", rounds: 3 } });
    s = put(s, at(3, "b"), { name: "Short", duration: { kind: "rounds", rounds: 1 }, countsOn: "a" });
    const before = at(4, "b");
    expect(left(s, before, 0)).toEqual({ state: "active", left: 2 });
    expect(left(s, before, 1).state).toBe("gone");
    const after = resetRounds(before);
    const r = resetEffectRounds(s, before, after);
    expect(r.effects).toHaveLength(1);
    expect(left(r, after)).toEqual({ state: "active", left: 2 });
    expect(left(r, at(2, "b")).state).toBe("ended");
  });

  it("sets an effect's rounds left from now", () => {
    const t = at(2, GM_ENTRY);
    const s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 5 } });
    expect(left(s, t)).toEqual({ state: "active", left: 4 });
    const edited = setRoundsLeft(s, t, s.effects[0].id, 1);
    expect(left(edited, t)).toEqual({ state: "active", left: 1 });
    expect(left(edited, at(3, "a")).state).toBe("ended");
    expect(setRoundsLeft(edited, t, s.effects[0].id, 1)).toBe(edited);
    expect(() => setRoundsLeft(s, t, s.effects[0].id, 0)).toThrow(RangeError);
  });

  it("Time passes ends rounds effects only (p. 82)", () => {
    const t = at(1, "a");
    let s = put(emptyEffects(), t, { duration: { kind: "rounds", rounds: 5 } });
    s = put(s, t, { name: "Hold Person", duration: { kind: "focus" } });
    s = put(s, t, { name: "Cursed, 1d4 days", duration: { kind: "until" } });
    expect(timePassesEffects(s).effects.map((e) => e.name)).toEqual(["Hold Person", "Cursed, 1d4 days"]);
    const none = timePassesEffects(s);
    expect(timePassesEffects(none)).toBe(none);
  });

  it("lists ended effects through their turn, and the next write drops gone ones", () => {
    let s = put(emptyEffects(), at(1, "a"), { duration: { kind: "rounds", rounds: 1 } });
    s = put(s, at(1, "a"), { name: "Long", duration: { kind: "rounds", rounds: 9 } });
    expect(endingNow(s, at(2, "a")).map((e) => e.name)).toEqual(["Bless"]);
    expect(shown(s, at(2, "a"))).toHaveLength(2);
    expect(shown(s, at(2, "b"))).toHaveLength(1);
    expect(settle(s, at(2, "a"))).toBe(s);
    expect(settle(s, at(2, "b")).effects.map((e) => e.name)).toEqual(["Long"]);
  });
});

describe("adding", () => {
  const t = at(1, "a");

  it("one per holder, or one free-standing; checks its input", () => {
    expect(put(emptyEffects(), t, { holders: [], duration: { kind: "until" } }).effects[0].holder).toBeNull();
    expect(put(emptyEffects(), t, { holders: ["a", "b", "a"], duration: { kind: "until" } }).effects).toHaveLength(2);
    expect(() => put(emptyEffects(), t, { holders: [GM_ENTRY], duration: { kind: "until" } })).toThrow(TypeError);
    expect(() => put(emptyEffects(), t, { name: " ", duration: { kind: "until" } })).toThrow(TypeError);
    expect(() => put(emptyEffects(), t, { duration: { kind: "rounds", rounds: 0 } })).toThrow(RangeError);
    expect(() => put(emptyEffects(), t, { duration: { kind: "rounds", rounds: 100 } })).toThrow(RangeError);
    expect(() => put(emptyEffects(), t, { icon: "focus", duration: { kind: "until" } })).toThrow(TypeError);
  });

  it("names a condition after itself when left blank, and cuts long names", () => {
    expect(put(emptyEffects(), t, { name: "", icon: "blinded", duration: { kind: "until" } }).effects[0].name).toBe("Blinded");
    expect(put(emptyEffects(), t, { name: "x".repeat(50), duration: { kind: "until" } }).effects[0].name).toHaveLength(NAME_MAX);
  });

  it("holds up to 24 effects a map, clearing gone ones first", () => {
    let s = put(emptyEffects(), t, { duration: { kind: "rounds", rounds: 1 } });
    for (let i = 1; i < MAX_EFFECTS; i++) s = put(s, t, { duration: { kind: "until" } });
    expect(() => put(s, t, { duration: { kind: "until" } })).toThrow(RangeError);
    // The first has gone by round 2's second turn: room for one more.
    expect(put(s, at(2, "b"), { duration: { kind: "until" } }).effects).toHaveLength(MAX_EFFECTS);
  });
});

describe("focus", () => {
  const t = at(1, "a");
  const holdPerson = () => {
    const s = put(emptyEffects(), t, { name: "Hold Person", duration: { kind: "focus" } });
    return put(s, t, { name: "", icon: "paralyzed", holders: ["m"], duration: { kind: "until" }, endsWith: s.effects[0].id });
  };

  it("needs a caster and wears the focus icon", () => {
    expect(() => put(emptyEffects(), t, { holders: [], duration: { kind: "focus" } })).toThrow(TypeError);
    expect(put(emptyEffects(), t, { duration: { kind: "focus" } }).effects[0].icon).toBe("focus");
  });

  it("one at a time: a second asks first, then ends the old one and what ends with it", () => {
    const s = holdPerson();
    expect(() => put(s, t, { name: "Web", duration: { kind: "focus" } })).toThrow(AlreadyFocusingError);
    const swapped = put(s, t, { name: "Web", duration: { kind: "focus" }, replaceFocus: true });
    expect(swapped.effects.map((e) => e.name)).toEqual(["Web"]);
  });

  it("ends with: only on a focus, never from a focus", () => {
    const s = holdPerson();
    expect(s.effects[1].endsWith).toBe(s.effects[0].id);
    expect(() => put(s, t, { duration: { kind: "focus" }, holders: ["b"], endsWith: s.effects[0].id })).toThrow(TypeError);
    expect(() => put(s, t, { duration: { kind: "until" }, endsWith: s.effects[1].id })).toThrow(TypeError);
  });

  it("Lost, Nat 1 or death ends the focus and what ends with it", () => {
    const s = holdPerson();
    expect(endFocus(s, s.effects[0].id).effects).toEqual([]);
    expect(endFocus(s, s.effects[1].id)).toBe(s);
    expect(endFocusOf(s, ["a"]).effects).toEqual([]);
    expect(endFocusOf(s, ["b"])).toBe(s);
    expect(removeEffects(s, [s.effects[1].id]).effects.map((e) => e.name)).toEqual(["Hold Person"]);
  });

  it("checks on the holder's turn; a monster's on the GM turn while crawling", () => {
    let s = put(emptyEffects(), t, { name: "Hold Person", duration: { kind: "focus" } });
    s = put(s, t, { name: "Darkness", holders: ["m"], duration: { kind: "focus" } });
    expect(focusChecks(s, at(1, "a")).map((e) => e.name)).toEqual(["Hold Person"]);
    expect(focusChecks(s, at(1, "b"))).toEqual([]);
    expect(focusChecks(s, at(1, GM_ENTRY)).map((e) => e.name)).toEqual(["Darkness"]);
    expect(focusChecks(s, base())).toEqual([]);
    const combat = steps(toCombat(at(1, "a"), false), 4);
    expect(combat.current).toBe("m");
    expect(focusChecks(s, combat).map((e) => e.name)).toEqual(["Darkness"]);
  });
});

describe("tokens and players", () => {
  const t = at(1, "a");

  it("a deleted token takes its effects, and what ends with its focus", () => {
    let s = put(emptyEffects(), t, { name: "Hold Person", duration: { kind: "focus" } });
    s = put(s, t, { name: "Paralyzed", holders: ["m"], duration: { kind: "until" }, endsWith: s.effects[0].id });
    s = put(s, t, { name: "Cloudkill", holders: [], duration: { kind: "until" } });
    expect(pruneEffects(s, (id) => id !== "a").effects.map((e) => e.name)).toEqual(["Cloudkill"]);
    expect(pruneEffects(s, () => true)).toBe(s);
  });

  it("players see no hidden effects, nor those on tokens hidden from them", () => {
    let s = put(emptyEffects(), t, { duration: { kind: "until" } });
    s = put(s, t, { name: "Secret", duration: { kind: "until" }, hidden: true });
    s = put(s, t, { name: "Lurker's", holders: ["m"], duration: { kind: "until" } });
    s = put(s, t, { name: "Ceiling", holders: [], duration: { kind: "until" } });
    expect(playerEffects(s, (id) => id !== "m").effects.map((e) => e.name)).toEqual(["Bless", "Ceiling"]);
  });
});

describe("undo", () => {
  it("puts back only the effects the step changed", () => {
    const t = at(1, "a");
    const from = put(emptyEffects(), t, { duration: { kind: "until" } });
    const to = put(from, t, { name: "Web", duration: { kind: "until" } });
    // Since the step, an automatic change removed Bless.
    const current = removeEffects(to, [from.effects[0].id]);
    expect(restoreEffects(current, to, from).effects).toEqual([]);
    // Redo brings Web back and keeps what's there.
    expect(restoreEffects(removeEffects(to, [to.effects[1].id]), from, to).effects.map((e) => e.name)).toEqual(["Bless", "Web"]);
  });
});

describe("parseEffects", () => {
  const t = at(1, "a");

  it("reads its own output", () => {
    let s = put(emptyEffects(), t, { name: "Hold Person", duration: { kind: "focus" } });
    s = put(s, t, { name: "Web", holders: ["b"], duration: { kind: "rounds", dice: "1d4" }, endsWith: s.effects[0].id, hidden: true });
    expect(parseEffects(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("drops junk, duplicates, a second focus and effects whose focus is gone", () => {
    const ok = { id: "x", name: "Bless", kind: "until", holder: "a" };
    expect(parseEffects(null)).toEqual(emptyEffects());
    expect(parseEffects({ effects: "no" })).toEqual(emptyEffects());
    const s = parseEffects({
      effects: [
        ok,
        ok,
        null,
        { id: "r", name: "Bad", kind: "rounds", rounds: 0, end: { round: 1, at: null } },
        { id: "r2", name: "No end", kind: "rounds", rounds: 3 },
        { id: "f1", name: "Hold", kind: "focus", holder: "a" },
        { id: "f2", name: "Web", kind: "focus", holder: "a" },
        { id: "f3", name: "Free", kind: "focus" },
        { id: "p", name: "Paralyzed", kind: "until", holder: "m", endsWith: "f2" },
        { id: "q", name: "", kind: "until", icon: "focus" },
        { id: "z", name: "", kind: "until", icon: "stuck", hidden: "yes" },
      ],
    });
    expect(s.effects.map((e) => e.id)).toEqual(["x", "f1", "z"]);
    expect(s.effects[2]).toMatchObject({ name: "Stuck", icon: "stuck", hidden: false });
  });

  it("caps the list, and the worst case stays small", () => {
    const id = (c: string) => c.repeat(64);
    const worst = {
      id: id("i"),
      name: "n".repeat(40),
      icon: "unconscious",
      holder: id("h"),
      kind: "rounds",
      rounds: 99,
      end: { round: 10098, at: id("a") },
      dice: "1d10",
      endsWith: null,
      hidden: true,
    };
    const many = Array.from({ length: 40 }, (_, i) => ({ ...worst, id: `${i}`.padStart(64, "i") }));
    const s = parseEffects({ effects: many });
    expect(s.effects).toHaveLength(MAX_EFFECTS);
    // Effect ids are 8 characters (newEffectId), item ids about 36.
    const real = {
      effects: s.effects.map((e) => ({ ...e, id: "abcd1234", holder: "h".repeat(36), end: { round: 9999, at: "a".repeat(36) }, endsWith: "abcd1234" })),
    };
    expect(new Blob([JSON.stringify(real)]).size).toBeLessThan(7000);
  });
});

describe("the death timer (p. 89)", () => {
  // The holder's timer status and whether the d20 is offered, turn by turn.
  const trace = (s: Effects, from: Tracker, turns: number, holder = "a") => {
    const out: string[] = [];
    let t = from;
    for (let i = 0; i < turns; i++) {
      t = next(t);
      if (t.current !== holder) continue;
      const st = statusOf(s.effects[0], t);
      out.push(`${t.round}:${st.state === "active" ? st.left : st.state}${deathRollDue(s.effects[0], t) ? "+d20" : ""}`);
    }
    return out;
  };

  it("1d4 + CON, at least 1", () => {
    expect(deathTimer(2, 1)).toBe(3);
    expect(deathTimer(1, -3)).toBe(1);
  });

  it("started on the holder's turn: N left now, a d20 on each later turn, ended N rounds on", () => {
    const t = at(3, "a");
    const s = startDying(emptyEffects(), t, newId, "a", 3);
    expect(s.effects[0]).toMatchObject({ name: "Dying", icon: "dying", holder: "a", rounds: 3, hidden: false });
    expect(statusOf(s.effects[0], t)).toEqual({ state: "active", left: 3 });
    expect(deathRollDue(s.effects[0], t)).toBe(false);
    expect(trace(s, t, 9)).toEqual(["4:2+d20", "5:1+d20", "6:ended"]);
  });

  it("started off their turn (after it, before it, between rounds): their next turn is the rolling turn", () => {
    const betweenRounds = { ...at(3, GM_ENTRY), current: null };
    const cases: [Tracker, string, string[]][] = [
      [at(3, "b"), "a", ["4:2", "5:1+d20", "6:ended"]], // after a's turn in round 3
      [at(3, "a"), "b", ["3:2", "4:1+d20", "5:ended"]], // before b's turn in round 3
      [betweenRounds, "a", ["4:2", "5:1+d20", "6:ended"]],
    ];
    for (const [from, holder, expected] of cases) {
      const s = startDying(emptyEffects(), from, newId, holder, 2);
      expect(trace(s, from, 12, holder).slice(0, 3)).toEqual(expected);
    }
  });

  it("player rows only, once; stop, stabilize (still unconscious), and Time passes leaves it", () => {
    const t = at(2, "a");
    expect(() => startDying(emptyEffects(), t, newId, "m", 2)).toThrow(TypeError);
    expect(() => startDying(emptyEffects(), t, newId, GM_ENTRY, 2)).toThrow(TypeError);
    expect(() => startDying(emptyEffects(), setDead(t, ["b"], true), newId, "b", 2)).toThrow(TypeError);
    const s = startDying(emptyEffects(), t, newId, "a", 2);
    expect(canDie(s, t, "a")).toBe(false);
    expect(() => startDying(s, t, newId, "a", 2)).toThrow(TypeError);
    expect(timePassesEffects(s)).toBe(s);
    expect(stopDying(s, "a").effects).toEqual([]);
    const st = stabilize(s, t, newId, "a");
    expect(dyingOf(st, "a")).toBeNull();
    expect(st.effects).toMatchObject([{ name: "Unconscious", icon: "unconscious", kind: "until", holder: "a" }]);
    expect(stabilize(emptyEffects(), t, newId, "a")).toEqual(emptyEffects());
  });

  it("parses back from scene metadata", () => {
    const s = startDying(emptyEffects(), at(2, "a"), newId, "a", 2);
    expect(parseEffects(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
