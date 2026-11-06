import { readLog } from "./sessionLog";
import { describe, it, expect, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, TRACKER_KEY } from "./constants";
import { endedMessage, newlyEnded, watchEffectNotices, type Reading } from "./effectNotices";
import { parseEffects } from "./effects";
import { GM_ENTRY, parseTracker } from "./tracker";
import { changePlayer, obr, setSceneReady, token, writeSceneFromElsewhere } from "./test/obrMock";

// Aria, Borin, GM / Monsters. Bless on Aria counts on her turn and ends at
// the start of her turn in round 3; Cloudkill (free-standing) at the top of
// round 3; Hold Person is a focus (never "ends" by itself).
const entries = [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }].map((e) => ({ roll: null, note: "", dead: false, ...e }));
const tracker = (current: string | null, round: number) => ({ entries, current, round });
const bless = { id: "e1", name: "Bless", kind: "rounds", holder: "a", rounds: 2, end: { round: 3, at: "a" } };
const cloud = { id: "e2", name: "Cloudkill", kind: "rounds", holder: null, rounds: 2, end: { round: 3, at: null } };
const hold = { id: "f1", name: "Hold Person", kind: "focus", holder: "b" };
const reading = (current: string | null, round: number, fx: object[] = [bless, cloud, hold]): Reading => ({
  tracker: parseTracker(tracker(current, round)),
  effects: parseEffects({ effects: fx }),
});
const names = (r: { name: string }[]) => r.map((e) => e.name);

describe("newlyEnded", () => {
  it("rounds effects that ran out as the turn moved on", () => {
    expect(names(newlyEnded(reading(GM_ENTRY, 2), reading("a", 3), new Set()))).toEqual(["Bless", "Cloudkill"]);
    expect(newlyEnded(reading("a", 2), reading("b", 2), new Set())).toEqual([]);
  });

  it("not once told, not if it was already ended or just appeared, not focus or removal", () => {
    const told = new Set(["e1@3:a"]);
    expect(names(newlyEnded(reading(GM_ENTRY, 2), reading("a", 3), told))).toEqual(["Cloudkill"]);
    expect(newlyEnded(reading("a", 3), reading("a", 3, [bless]), new Set())).toEqual([]);
    expect(newlyEnded(reading(GM_ENTRY, 2, []), reading("a", 3), new Set())).toEqual([]);
    expect(newlyEnded(reading(GM_ENTRY, 2), reading("a", 3, []), new Set())).toEqual([]);
  });

  it("a new end (rounds left edited) is told again", () => {
    const later = { ...bless, end: { round: 4, at: "a" } };
    expect(names(newlyEnded(reading(GM_ENTRY, 3, [later]), reading("a", 4, [later]), new Set(["e1@3:a"])))).toEqual(["Bless"]);
  });
});

describe("endedMessage", () => {
  const ended = (fx: object[]) => parseEffects({ effects: fx }).effects;
  const aria = { id: "a", name: "Aria", visible: true };

  it("names the holder; free-standing ones stand alone", () => {
    expect(endedMessage(ended([bless, cloud]), [aria], false)).toBe("Bless on Aria ended. Cloudkill ended.");
  });

  it("players don't hear of hidden effects, hidden tokens or gone ones; the GM hears all", () => {
    const fx = ended([{ ...bless, hidden: true }]);
    expect(endedMessage(fx, [aria], false)).toBe("");
    expect(endedMessage(fx, [aria], true)).toBe("Bless on Aria ended.");
    expect(endedMessage(ended([bless]), [{ ...aria, visible: false }], false)).toBe("");
    expect(endedMessage(ended([bless]), [], false)).toBe("");
    expect(endedMessage(ended([bless]), [], true)).toBe("Bless ended.");
  });
});

describe("watchEffectNotices (every client)", () => {
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const shown = () => vi.mocked(OBR.notification.show).mock.calls.map((c) => c[0]);
  const scene = (current: string | null, round: number, fx: object[] = [bless, cloud, hold]) => ({
    [TRACKER_KEY]: tracker(current, round),
    [EFFECTS_KEY]: { effects: fx },
  });

  it("tells once when ▶ ends an effect; ◀ then ▶ doesn't repeat it", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    obr.sceneMetadata = scene(GM_ENTRY, 2);
    const off = watchEffectNotices();
    await settle();
    await writeSceneFromElsewhere(scene("a", 3));
    await settle();
    expect(shown()).toEqual(["Bless on Aria ended. Cloudkill ended."]);
    expect(readLog().map((e) => e.text)).toEqual(["Bless on Aria ended. Cloudkill ended."]);
    await writeSceneFromElsewhere(scene(GM_ENTRY, 2));
    await writeSceneFromElsewhere(scene("a", 3));
    await settle();
    expect(shown()).toHaveLength(1);
    off();
  });

  it("logs (no notice) effects that go away; not those already ended; players not hidden ones", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    const secret = { id: "h1", name: "Secret", kind: "until", holder: "b", hidden: true };
    obr.sceneMetadata = scene("a", 3, [bless, cloud, hold, secret]);
    const off = watchEffectNotices();
    await settle();
    // Bless and Cloudkill ended at Aria's turn in round 3: their going isn't news.
    await writeSceneFromElsewhere(scene("a", 3, [hold, secret]));
    await settle();
    expect(readLog()).toEqual([]);
    await writeSceneFromElsewhere(scene("a", 3, []));
    await settle();
    expect(shown()).toEqual([]);
    expect(readLog().map((e) => e.text)).toEqual(["Hold Person on Borin removed. Secret on Borin removed."]);
    off();
  });

  it("a death timer running out says so; Dying going away isn't logged as removed (the death events tell it)", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    const dying = { id: "d1", name: "Dying", icon: "dying", kind: "rounds", holder: "a", rounds: 2, end: { round: 3, at: "a" } };
    obr.sceneMetadata = scene(GM_ENTRY, 2, [dying]);
    const off = watchEffectNotices();
    await settle();
    await writeSceneFromElsewhere(scene("a", 3, [dying]));
    await settle();
    expect(shown()).toEqual(["Aria's death timer ran out."]);
    const healed = { ...dying, id: "d2", end: { round: 9, at: "a" } };
    await writeSceneFromElsewhere(scene("a", 3, [healed]));
    await writeSceneFromElsewhere(scene("a", 3, []));
    await settle();
    expect(readLog().map((e) => e.text)).toEqual(["Aria's death timer ran out."]);
    off();
  });

  it("says nothing for what's already ended when the page loads or a scene opens", async () => {
    obr.sceneMetadata = scene("a", 3);
    const off = watchEffectNotices();
    await settle();
    await setSceneReady(false);
    await setSceneReady(true, { metadata: scene("a", 3) });
    await settle();
    await writeSceneFromElsewhere(scene("b", 3));
    await settle();
    expect(shown()).toEqual([]);
    off();
  });

  it("players: nothing for a hidden effect or one on a token hidden from them", async () => {
    await changePlayer({ role: "PLAYER" });
    obr.items = [token("a", { name: "Aria", visible: false })];
    obr.sceneMetadata = scene(GM_ENTRY, 2, [bless, { ...cloud, hidden: true }]);
    const off = watchEffectNotices();
    await settle();
    await writeSceneFromElsewhere(scene("a", 3, [bless, { ...cloud, hidden: true }]));
    await settle();
    expect(shown()).toEqual([]);
    off();
  });

  it("stops listening when unsubscribed", async () => {
    obr.sceneMetadata = scene(GM_ENTRY, 2);
    const off = watchEffectNotices();
    await settle();
    off();
    await writeSceneFromElsewhere(scene("a", 3));
    await settle();
    expect(shown()).toEqual([]);
  });
});
