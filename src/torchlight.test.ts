import { describe, it, expect, vi } from "vitest";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { DF_LIGHT_KEY, DIM_KEY, TORCHLIGHT_TOKEN_KEY, dimLight, feetToPx, lightOn, planDim, watchDimLights } from "./torchlight";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, setItems, token, writeFromElsewhere, writeSceneFromElsewhere } from "./test/obrMock";

const lit = (id: string, source: unknown = "torch", extra: Partial<Item> = {}) => ({
  ...token(id, extra),
  metadata: { [TORCHLIGHT_TOKEN_KEY]: { source, saved: null } },
});
const doc = (entries: object[]) => parseTracker({ entries });
// 3 ft on Owlbear's default 5 ft grid at 150 dpi.
const DIM_PX = 90;

describe("reading Torchlight", () => {
  it("a token's light; an unknown source still counts", () => {
    expect(lightOn(lit("a", "lantern"))).toBe("lantern");
    expect(lightOn(lit("a", "bonfire"))).toBe("torch");
    expect(lightOn(token("a"))).toBeNull();
  });

  it("feet to pixels: 5 ft cells; other units count as 5 ft cells", () => {
    expect(feetToPx(3, 150, "ft", 5)).toBe(90);
    expect(feetToPx(3, 150, "m", 1.5)).toBe(90);
  });
});

describe("planDim", () => {
  it("the party's tokens with no light of their own; not monsters, the dead or the lit", () => {
    const own = { ...token("q"), metadata: { [DF_LIGHT_KEY]: dimLight(300) } };
    const tq = doc([{ id: "p" }, { id: "q" }, { id: "l" }, { id: "dead", dead: true }, { id: "m", monster: true }]);
    expect(planDim(tq, [token("p"), own, lit("l"), token("dead"), token("m"), token("x")], DIM_PX)).toEqual({
      add: ["p"],
      remove: [],
      forget: [],
    });
  });

  it("ours come off when the token stops qualifying; one someone changed is theirs; one Torchlight lit over waits", () => {
    const ours = (id: string, light = dimLight(DIM_PX)) => ({ ...token(id), metadata: { [DF_LIGHT_KEY]: light, [DIM_KEY]: true } });
    const relit = { ...ours("r"), metadata: { ...ours("r").metadata, [TORCHLIGHT_TOKEN_KEY]: { source: "torch" } } };
    const tp = doc([{ id: "p", dead: true }, { id: "c", monster: true }, { id: "r", dead: true }, { id: "s" }]);
    expect(planDim(tp, [ours("p"), ours("c", dimLight(500)), relit, ours("s")], DIM_PX)).toEqual({ add: [], remove: ["p"], forget: ["c"] });
  });
});

describe("watchDimLights (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const radius = (i: number) => (obr.items[i].metadata[DF_LIGHT_KEY] as { attenuationRadius?: number } | undefined)?.attenuationRadius;
  const entries = [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }];
  const start = async () => {
    obr.role = "GM";
    obr.items = [token("a"), token("b"), token("c")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries } };
    const off = watchDimLights();
    await settle();
    return off;
  };

  it("3 ft on every party token, lit or dark; a token added to the list gets it, one marked dead loses it", async () => {
    const off = await start();
    expect([radius(0), radius(1), radius(2)]).toEqual([DIM_PX, DIM_PX, undefined]);
    // A lit light in the Light Tracker (no map light of its own yet) leaves the minimum on.
    await writeFromElsewhere({
      [LIGHTS_KEY]: { lights: [{ id: "l", kind: "torch", tokenId: "a", status: "lit", remainingMs: 3_600_000, endsAt: Date.now() + 3_600_000 }] },
    });
    await settle();
    expect(radius(0)).toBe(DIM_PX);
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: "a", dead: true }, { id: "b" }, { id: "c" }, { id: GM_ENTRY }] } });
    await settle();
    expect([radius(0), radius(1), radius(2)]).toEqual([undefined, DIM_PX, DIM_PX]);
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    off();
  });

  it("players' clients never write", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } };
    const off = watchDimLights();
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
