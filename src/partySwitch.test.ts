import { describe, it, expect } from "vitest";

import { MINUTE, parseLights, remaining } from "./lights";
import { planSwitch } from "./partySwitch";
import { GM_ENTRY, parseTracker, setParty, setTogether, type Tracker } from "./tracker";

const NOW = Date.parse("2026-11-07T20:00:00Z");
const entry = (id: string, extra = {}) => ({ id, roll: null, note: "", dead: false, monster: false, marker: true, ...extra });
const base = (): Tracker =>
  setParty(parseTracker({ entries: [entry("a"), entry("b"), entry("m", { monster: true }), entry(GM_ENTRY, { marker: false })] }), "p");
const lit = (tokenId: string, id = `l-${tokenId}`, kind = "torch") => ({ id, kind, tokenId, carrier: "x", status: "lit", remainingMs: 60 * MINUTE, endsAt: NOW + 60 * MINUTE });
const name = (id: string) => id.toUpperCase();
const run = (t: Tracker, l: unknown[], together: boolean, pick?: string) => planSwitch(t, parseLights({ lights: l }), NOW, together, name, pick);
const done = (r: ReturnType<typeof run>) => {
  if (!r.done) throw new Error("needed a pick");
  return r;
};

describe("coming together", () => {
  it("a player's light goes to the Party token with its timer; they're remembered as the carrier", () => {
    const r = done(run(base(), [lit("b")], true));
    expect(r.lights.lights).toMatchObject([{ tokenId: "p", carrier: "P", status: "lit" }]);
    expect(remaining(r.lights.lights[0], NOW)).toBe(60 * MINUTE);
    expect(r.tracker).toMatchObject({ together: true, carrier: "b" });
  });

  it("no lights: just the switch; a light already on the Party token stays; a second lit light stays where it is", () => {
    expect(done(run(base(), [], true)).tracker.together).toBe(true);
    const two = done(run(base(), [lit("a"), lit("b")], true));
    expect(two.stayed).toBe(1);
    expect(two.lights.lights.map((l) => l.tokenId).sort()).toEqual(["b", "p"]);
  });

  it("a monster's or the GM's light is nobody's to take", () => {
    const r = done(run(base(), [lit("m")], true));
    expect(r.lights.lights[0].tokenId).toBe("m");
  });
});

describe("splitting", () => {
  const together = () => setTogether(base(), true, "b");

  it("the light goes to the remembered carrier with its timer", () => {
    const r = done(run(together(), [lit("p")], false));
    expect(r.lights.lights).toMatchObject([{ tokenId: "b", carrier: "B" }]);
    expect(r.tracker).toMatchObject({ together: false, carrier: "b" });
  });

  it("with no remembered carrier it asks, and the pick is the carrier from then on", () => {
    const t = setTogether(base(), true, null);
    const ask = run(t, [lit("p")], false);
    expect(ask).toEqual({ done: false, choices: ["a", "b"] });
    const r = done(run(t, [lit("p")], false, "a"));
    expect(r.lights.lights[0].tokenId).toBe("a");
    expect(r.tracker.carrier).toBe("a");
  });

  it("a dead carrier isn't offered the light; a pick that isn't a player is ignored", () => {
    const t = parseTracker({ ...JSON.parse(JSON.stringify(together())), entries: together().entries.map((e) => (e.id === "b" ? { ...e, dead: true } : e)) });
    expect(run(t, [lit("p")], false)).toEqual({ done: false, choices: ["a"] });
    expect(run(t, [lit("p")], false, "m")).toEqual({ done: false, choices: ["a"] });
  });

  it("no light on the Party token: no question, just the switch", () => {
    const r = done(run(setTogether(base(), true, null), [lit("a")], false));
    expect(r.tracker.together).toBe(false);
    expect(r.lights.lights[0].tokenId).toBe("a");
  });

  it("a lantern that's out goes along with its oil", () => {
    const out = { ...lit("p", "lan", "lantern"), status: "out", remainingMs: 30 * MINUTE, endsAt: null };
    const r = done(run(together(), [out], false));
    expect(r.lights.lights[0]).toMatchObject({ tokenId: "b", status: "out", remainingMs: 30 * MINUTE });
  });

  it("no Party token or already in that state: nothing changes", () => {
    const none = parseTracker({ entries: [entry("a"), entry(GM_ENTRY)] });
    expect(run(none, [lit("a")], true)).toMatchObject({ done: true, tracker: none });
    const t = base();
    expect(done(run(t, [lit("p")], false)).tracker).toBe(t);
  });
});
