import { describe, it, expect, vi } from "vitest";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { MINUTE, parseLights } from "./lights";
import { TORCHLIGHT_TOKEN_KEY, lightOn } from "./torchlight";
import { BADGE_KEY } from "./constants";
import { DF_LIGHT_KEY, DIM_KEY, LIT_KEY, badgeImage, dfLight, feetToPx, planBadges, planTokenLights, watchTokenLights } from "./tokenLights";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, setItems, token, writeFromElsewhere, writeSceneFromElsewhere } from "./test/obrMock";

const torchlit = (id: string, source: unknown = "torch", extra: Partial<Item> = {}) => ({
  ...token(id, extra),
  metadata: { [TORCHLIGHT_TOKEN_KEY]: { source, saved: null } },
});
const doc = (entries: object[]) => parseTracker({ entries });
// Owlbear's default 5 ft grid at 150 dpi: 30 px a foot.
const px = (ft: number) => ft * 30;
const NOW = 1_000_000;
const light = (tokenId: string, kind = "torch", status = "lit", extra: object = {}) => ({
  id: `l-${tokenId}`,
  kind,
  tokenId,
  status,
  remainingMs: status === "lit" ? 60 * MINUTE : 0,
  endsAt: status === "lit" ? NOW + 60 * MINUTE : null,
  ...extra,
});
const lights = (...ls: object[]) => parseLights({ lights: ls });
const NONE = lights();
const with_ = (id: string, metadata: Record<string, unknown>, extra: Partial<Item> = {}) => ({ ...token(id, extra), metadata });

describe("reading Torchlight", () => {
  it("a token's light; an unknown source still counts", () => {
    expect(lightOn(torchlit("a", "lantern"))).toBe("lantern");
    expect(lightOn(torchlit("a", "bonfire"))).toBe("torch");
    expect(lightOn(token("a"))).toBeNull();
  });

  it("feet to pixels: 5 ft cells; other units count as 5 ft cells", () => {
    expect(feetToPx(3, 150, "ft", 5)).toBe(90);
    expect(feetToPx(3, 150, "m", 1.5)).toBe(90);
  });
});

describe("planTokenLights: the 3 ft minimum", () => {
  it("the party's tokens with no light of their own; not monsters, the dead, props or Torchlight's", () => {
    const own = with_("q", { [DF_LIGHT_KEY]: dfLight(300) });
    const t = doc([{ id: "p" }, { id: "q" }, { id: "l" }, { id: "dead", dead: true }, { id: "m", monster: true }, { id: "prop" }]);
    const items = [token("p"), own, torchlit("l"), token("dead"), token("m"), token("x"), token("prop", { layer: "PROP" })];
    expect(planTokenLights(t, items, NONE, NOW, px)).toEqual([{ id: "p", light: dfLight(90), dim: true }]);
  });

  it("ours come off when the token stops qualifying; one someone changed is theirs", () => {
    const ours = (id: string, l = dfLight(90)) => with_(id, { [DF_LIGHT_KEY]: l, [DIM_KEY]: true });
    const t = doc([{ id: "p", dead: true }, { id: "c", monster: true }, { id: "s" }]);
    expect(planTokenLights(t, [ours("p"), ours("c", dfLight(500)), ours("s")], NONE, NOW, px)).toEqual([
      { id: "p", light: null, dim: false },
      { id: "c", dim: false },
    ]);
  });
});

describe("planTokenLights: lit lights", () => {
  const t = doc([{ id: "p" }]);

  it("a lit light gives its range (lantern double near), replacing our 3 ft and saving nothing for it", () => {
    const dimmed = with_("p", { [DF_LIGHT_KEY]: dfLight(90), [DIM_KEY]: true });
    expect(planTokenLights(t, [dimmed], lights(light("p", "lantern")), NOW, px)).toEqual([
      { id: "p", light: dfLight(1800), lit: { saved: null, kind: "lantern" }, dim: false },
    ]);
  });

  it("any token, a prop's campfire included; the token's own light is saved", () => {
    const own = { attenuationRadius: 400, sourceRadius: 10, falloff: 1, innerAngle: 90, outerAngle: 120, lightType: "PRIMARY", junk: "x" };
    const fire = with_("f", { [DF_LIGHT_KEY]: own }, { layer: "PROP" });
    expect(planTokenLights(doc([]), [fire], lights(light("f", "campfire")), NOW, px)).toEqual([
      { id: "f", light: dfLight(900), lit: { saved: { attenuationRadius: 400, sourceRadius: 10, falloff: 1, innerAngle: 90, outerAngle: 120, lightType: "PRIMARY" }, kind: "campfire" } },
    ]);
  });

  it("nothing to do while it's in step; a paused light still shines", () => {
    const lit = with_("p", { [DF_LIGHT_KEY]: dfLight(900), [LIT_KEY]: { saved: null, kind: "torch" } });
    expect(planTokenLights(t, [lit], lights(light("p")), NOW, px)).toEqual([]);
    const paused = parseLights({ paused: true, lights: [light("p", "torch", "lit", { endsAt: null })] });
    expect(planTokenLights(t, [lit], paused, NOW, px)).toEqual([]);
  });

  it("a swap changes the range and keeps what was saved", () => {
    const saved = { attenuationRadius: 50, lightType: "PRIMARY" };
    const lit = with_("p", { [DF_LIGHT_KEY]: dfLight(900), [LIT_KEY]: { saved, kind: "torch" } });
    expect(planTokenLights(t, [lit], lights(light("p", "lantern")), NOW, px)).toEqual([{ id: "p", light: dfLight(1800), lit: { saved, kind: "lantern" } }]);
  });

  it("when it stops: the saved light back; none saved, the party's 3 ft; anyone else, nothing", () => {
    const saved = { attenuationRadius: 50, lightType: "PRIMARY" };
    const items = [
      with_("own", { [DF_LIGHT_KEY]: dfLight(900), [LIT_KEY]: { saved, kind: "torch" } }),
      with_("p", { [DF_LIGHT_KEY]: dfLight(900), [LIT_KEY]: { saved: null, kind: "torch" } }),
      with_("m", { [DF_LIGHT_KEY]: dfLight(900), [LIT_KEY]: { saved: null, kind: "torch" } }),
    ];
    const t2 = doc([{ id: "own" }, { id: "p" }, { id: "m", monster: true }]);
    // Burned out at its end time, with nothing written.
    const burned = lights(light("own", "torch", "lit", { endsAt: NOW - 1 }), light("p", "torch", "spent"));
    expect(planTokenLights(t2, items, burned, NOW, px)).toEqual([
      { id: "own", light: saved, lit: null },
      { id: "p", light: dfLight(90), lit: null, dim: true },
      { id: "m", light: null, lit: null },
    ]);
  });
});

describe("planBadges: the light's icon on the token", () => {
  const badge = (id: string, on: string, image: string | null, visible = true) => ({ id, attachedTo: on, image: image ?? undefined, visible });

  it("torch, lantern and Light spell get their icon; a campfire (stationary) gets none", () => {
    const items = [token("a"), token("b"), token("c"), token("f", { layer: "PROP" })];
    const s = lights(light("a"), light("b", "lantern"), light("c", "lightSpell"), light("f", "campfire"));
    expect(planBadges([], items, s, NOW).add).toEqual([
      { tokenId: "a", image: badgeImage("torch") },
      { tokenId: "b", image: badgeImage("lantern") },
      { tokenId: "c", image: badgeImage("lightSpell") },
    ]);
    expect(badgeImage("campfire")).toBeNull();
  });

  it("keeps one good badge; strays, duplicates, the wrong light, a hidden token's mismatch and spent lights' badges go", () => {
    const items = [token("a"), token("b", { visible: false }), token("c")];
    const s = lights(light("a"), light("b"), light("c", "torch", "spent"));
    const plan = planBadges(
      [badge("1", "a", badgeImage("torch")), badge("2", "a", badgeImage("torch")), badge("3", "b", badgeImage("torch")), badge("4", "c", badgeImage("torch")), badge("5", "gone", badgeImage("torch"))],
      items,
      s,
      NOW,
    );
    expect(plan).toEqual({ remove: ["2", "3", "4", "5"], add: [{ tokenId: "b", image: badgeImage("torch") }] });
  });
});

describe("watchTokenLights (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const radius = (i: number) => (obr.items[i].metadata[DF_LIGHT_KEY] as { attenuationRadius?: number } | undefined)?.attenuationRadius;
  const start = async () => {
    obr.role = "GM";
    obr.items = [token("a"), token("b"), token("c")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }] } };
    const off = watchTokenLights();
    await settle();
    return off;
  };
  const torch = (endsAt: number) => ({ id: "l", kind: "torch", tokenId: "a", status: "lit", remainingMs: 60 * MINUTE, endsAt });

  it("3 ft on the party; a lit torch gives 30 ft and back to 3 ft when put out; the list changing moves the 3 ft", async () => {
    const off = await start();
    expect([radius(0), radius(1), radius(2)]).toEqual([90, 90, undefined]);
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [torch(Date.now() + 60 * MINUTE)] } });
    await settle();
    expect([radius(0), radius(1)]).toEqual([900, 90]);
    const badges = () => obr.items.filter((i) => i.metadata[BADGE_KEY] === true);
    expect(badges()).toMatchObject([{ attachedTo: "a", layer: "ATTACHMENT", image: { url: badgeImage("torch") } }]);
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [{ ...torch(0), status: "spent", remainingMs: 0, endsAt: null }] } });
    await settle();
    expect(radius(0)).toBe(90);
    expect(badges()).toEqual([]);
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: "a", dead: true }, { id: "b" }, { id: "c" }, { id: GM_ENTRY }] } });
    await settle();
    expect([radius(0), radius(1), radius(2)]).toEqual([undefined, 90, 90]);
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    off();
  });

  it("a torch burning out goes back to 3 ft on a timer, with no write to mark it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      obr.role = "GM";
      obr.items = [token("a")];
      obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }] } };
      obr.metadata = { [LIGHTS_KEY]: { lights: [torch(Date.now() + 1000)] } };
      const off = watchTokenLights();
      await vi.advanceTimersByTimeAsync(10);
      expect(radius(0)).toBe(900);
      await vi.advanceTimersByTimeAsync(1100);
      expect(radius(0)).toBe(90);
      off();
    } finally {
      vi.useRealTimers();
    }
  });

  it("players' clients never write", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } };
    const off = watchTokenLights();
    await settle();
    expect(OBR.scene.items.updateItems).not.toHaveBeenCalled();
    off();
  });

  it("stops when unsubscribed", async () => {
    const off = await start();
    off();
    vi.mocked(OBR.scene.items.getItems).mockClear();
    await setItems([token("a")]);
    await settle();
    expect(OBR.scene.items.getItems).not.toHaveBeenCalled();
  });
});
