import { describe, it, expect } from "vitest";
import type { Image, Item } from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, EFFECT_ICON_KEY, EFFECT_SLOT_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { buildEffectIcon, iconImage, planEffectIcons, tokenIcons, watchEffectIcons } from "./effectIcons";
import { parseEffects } from "./effects";
import { GM_ENTRY, parseTracker } from "./tracker";
import { changePlayer, obr, setItems, token, writeFromElsewhere, writeSceneFromElsewhere } from "./test/obrMock";

// Aria and Borin; Aria's turn in round 1.
const entries = [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }].map((e) => ({ roll: null, note: "", dead: false, ...e }));
const tracker = (current: string | null = "a", round = 1) => ({ entries, current, round });
const t = parseTracker(tracker());
const fx = (...effects: object[]) => parseEffects({ effects });
let n = 0;
const until = (holder: string | null, extra: object = {}) => ({ id: `u${++n}`, name: "Thing", kind: "until", holder, ...extra });
const focus = (holder: string) => ({ id: `f${++n}`, name: "Hold Person", kind: "focus", holder });
const bless = (holder: string, endRound: number) => ({ id: `r${++n}`, name: "Bless", kind: "rounds", holder, rounds: 2, end: { round: endRound, at: "a" } });
const names = (s: ReturnType<typeof fx>, tr = t) => (tokenIcons(s, tr).get("a") ?? []).map((i) => (i.hidden ? `(${i.name})` : i.name));

describe("tokenIcons", () => {
  it("focus first, then conditions in order, then one asterisk for the rest; three at most, then +", () => {
    expect(names(fx(until("a"), until("a", { icon: "dis" }), focus("a")))).toEqual(["focus", "dis", "custom"]);
    expect(names(fx(until("a", { icon: "stuck" }), until("a", { icon: "adv" }), until("a"), focus("a")))).toEqual(["focus", "adv", "more"]);
    expect(names(fx(until("a"), until("a"), until("a")))).toEqual(["custom"]);
  });

  it("running effects only, on tokens only: not ended, not free-standing", () => {
    expect(names(fx(bless("a", 2)))).toEqual(["custom"]);
    expect(names(fx(bless("a", 1)))).toEqual([]);
    expect(tokenIcons(fx(until(null)), t).size).toBe(0);
  });

  it("hidden icons go last; an icon is hidden only if all its effects are; + is hidden only if all it stands for are", () => {
    expect(names(fx(until("a", { hidden: true }), until("a", { icon: "dis" })))).toEqual(["dis", "(custom)"]);
    expect(names(fx(until("a", { hidden: true }), until("a")))).toEqual(["custom"]);
    expect(names(fx(focus("a"), until("a", { icon: "adv", hidden: true }), until("a", { icon: "dis", hidden: true }), until("a", { hidden: true })))).toEqual([
      "focus",
      "(adv)",
      "(more)",
    ]);
  });
});

describe("planEffectIcons", () => {
  const items = [token("a"), token("b", { visible: false })];
  const state = (attachedTo: string, name: string, slot: string, visible = true, id = `${attachedTo}-${slot}`) => ({ id, attachedTo, image: iconImage(name as "adv"), visible, slot });

  it("adds what's missing, keeps what's right, drops the rest", () => {
    const s = fx(focus("a"), until("a", { icon: "adv" }), until("b"));
    const plan = planEffectIcons([state("a", "focus", "1/2"), state("a", "dis", "2/2"), state("a", "focus", "1/2", true, "dup"), state("z", "adv", "1/1")], items, s, t, true);
    expect(plan.remove).toEqual(["a-2/2", "dup", "z-1/1"]);
    expect(plan.add).toEqual([
      { tokenId: "a", image: iconImage("adv"), visible: true, slot: "2/2" },
      { tokenId: "b", image: iconImage("custom"), visible: false, slot: "1/1" },
    ]);
  });

  it("a hidden effect's icon is drawn hidden; off in Settings, every icon goes", () => {
    const s = fx(until("a", { hidden: true }));
    expect(planEffectIcons([], items, s, t, true).add).toEqual([{ tokenId: "a", image: iconImage("custom"), visible: false, slot: "1/1" }]);
    expect(planEffectIcons([state("a", "custom", "1/1", false)], items, s, t, false)).toEqual({ remove: ["a-1/1"], add: [] });
  });

  it("the row is centered on the token's bottom edge", () => {
    const tok = { ...token("a"), position: { x: 1000, y: 1000 } } as Image;
    const at = (slot: string) => buildEffectIcon(tok, { tokenId: "a", image: iconImage("adv"), visible: true, slot }, 150).position;
    expect(at("1/1").x).toBe(1000);
    expect(at("1/3").x).toBeLessThan(1000);
    expect(at("3/3").x - 1000).toBeCloseTo(1000 - at("1/3").x);
    expect(at("2/3").y).toBeGreaterThan(1000);
  });
});

describe("watchEffectIcons (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const icons = () =>
    obr.items
      .filter((i: Item) => i.metadata[EFFECT_ICON_KEY] === true)
      .map((i) => `${i.attachedTo} ${i.metadata[EFFECT_SLOT_KEY]} ${(i as Image).image.url.split("/").pop()}${i.visible ? "" : " hidden"}`);
  const start = async (role: "GM" | "PLAYER" = "GM") => {
    obr.role = role;
    obr.items = [token("a"), token("b")];
    obr.sceneMetadata = { [TRACKER_KEY]: tracker(), [EFFECTS_KEY]: { effects: [] } };
    const off = watchEffectIcons();
    await settle();
    return off;
  };

  it("draws a token's icons as effects come and go, follows the setting", async () => {
    const off = await start();
    await writeSceneFromElsewhere({ [EFFECTS_KEY]: { effects: [focus("a"), until("a", { icon: "dis", hidden: true })] } });
    await settle();
    expect(icons()).toEqual(["a 1/2 effect-focus.webp", "a 2/2 effect-dis.webp hidden"]);
    // Ending the turn it ends on: Bless runs out at the start of Aria's round-2 turn.
    await writeSceneFromElsewhere({ [EFFECTS_KEY]: { effects: [bless("b", 2)] } });
    await settle();
    expect(icons()).toEqual(["b 1/1 effect-custom.webp"]);
    await writeSceneFromElsewhere({ [TRACKER_KEY]: tracker("a", 2) });
    await settle();
    expect(icons()).toEqual([]);
    await writeSceneFromElsewhere({ [EFFECTS_KEY]: { effects: [until("a")] } });
    await settle();
    expect(icons()).toHaveLength(1);
    await writeFromElsewhere({ [SETTINGS_KEY]: { effectIcons: false } });
    await settle();
    expect(icons()).toEqual([]);
    off();
  });

  it("hiding the token hides its icons", async () => {
    const off = await start();
    await writeSceneFromElsewhere({ [EFFECTS_KEY]: { effects: [until("a")] } });
    await settle();
    await setItems(obr.items.map((i) => (i.id === "a" ? { ...i, visible: false } : i)));
    await settle();
    expect(icons()).toEqual(["a 1/1 effect-custom.webp hidden"]);
    off();
  });

  it("players' clients draw nothing", async () => {
    const off = await start("PLAYER");
    await writeSceneFromElsewhere({ [EFFECTS_KEY]: { effects: [until("a")] } });
    await settle();
    expect(icons()).toEqual([]);
    await changePlayer({ role: "GM" });
    await settle();
    expect(icons()).toHaveLength(1);
    off();
  });
});
