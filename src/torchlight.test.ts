import { describe, it, expect, vi } from "vitest";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { DF_LIGHT_KEY, DIM_KEY, TORCHLIGHT_TOKEN_KEY, dimLight, feetToPx, lightOn, planDim, watchDarkness } from "./torchlight";
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
  const t = doc([{ id: "p" }, { id: "dead", dead: true }, { id: "m", monster: true }, { id: GM_ENTRY }]);

  it("in the dark: the party's unlit tokens with no light of their own; not monsters, the dead or the lit", () => {
    const own = { ...token("q"), metadata: { [DF_LIGHT_KEY]: dimLight(300) } };
    const tq = doc([{ id: "p" }, { id: "q" }, { id: "l" }, { id: "dead", dead: true }, { id: "m", monster: true }]);
    expect(planDim(tq, [token("p"), own, lit("l"), token("dead"), token("m"), token("x")], true, DIM_PX)).toEqual({
      add: ["p"],
      remove: [],
      forget: [],
    });
  });

  it("light again: ours come off; one someone changed is theirs; one Torchlight lit over waits", () => {
    const ours = (id: string, light = dimLight(DIM_PX)) => ({ ...token(id), metadata: { [DF_LIGHT_KEY]: light, [DIM_KEY]: true } });
    const relit = { ...ours("r"), metadata: { ...ours("r").metadata, [TORCHLIGHT_TOKEN_KEY]: { source: "torch" } } };
    const tp = doc([{ id: "p" }, { id: "c" }, { id: "r" }]);
    expect(planDim(tp, [ours("p"), ours("c", dimLight(500)), relit], false, DIM_PX)).toEqual({ add: [], remove: ["p"], forget: ["c"] });
    // Still dark: ours stay.
    expect(planDim(t, [ours("p")], true, DIM_PX)).toEqual({ add: [], remove: [], forget: [] });
  });
});

describe("watchDarkness (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const radius = (i: number) => (obr.items[i].metadata[DF_LIGHT_KEY] as { attenuationRadius?: number } | undefined)?.attenuationRadius;
  const ourLight = (id: string, status: string, endsAt: number | null = null) => ({
    id: `l-${id}`,
    kind: "torch",
    tokenId: id,
    status,
    remainingMs: status === "lit" ? 60 * 60_000 : 0,
    endsAt,
  });
  const start = async (lights: object[], crawl: object = {}) => {
    obr.role = "GM";
    obr.items = [token("a"), token("b")];
    obr.metadata = { [LIGHTS_KEY]: { lights } };
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], crawl } };
    const off = watchDarkness();
    await settle();
    return off;
  };

  it("no light shining in the Light Tracker: dim lights on the party; a light back takes them off; darkness is never written", async () => {
    const off = await start([ourLight("a", "spent")]);
    expect([radius(0), radius(1)]).toEqual([DIM_PX, DIM_PX]);
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [ourLight("a", "lit", Date.now() + 60 * 60_000)] } });
    await settle();
    expect([radius(0), radius(1)]).toEqual([undefined, undefined]);
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    off();
  });

  it("a light burning out turns it dark on a timer, with no write to mark it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const off = watchDarknessWith([ourLight("a", "lit", Date.now() + 1000)]);
      await vi.advanceTimersByTimeAsync(10);
      expect(radius(0)).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1100);
      expect([radius(0), radius(1)]).toEqual([DIM_PX, DIM_PX]);
      off();
    } finally {
      vi.useRealTimers();
    }
  });

  it("no lights tracked: the map's switch decides, so a room not using lights is never darkened", async () => {
    const off = await start([]);
    expect(radius(0)).toBeUndefined();
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], crawl: { dark: true } } });
    await settle();
    expect([radius(0), radius(1)]).toEqual([DIM_PX, DIM_PX]);
    off();
  });

  it("Follow light off: the map's switch, not the lights", async () => {
    const off = await start([ourLight("a", "spent")]);
    expect(radius(0)).toBe(DIM_PX);
    await writeFromElsewhere({ [SETTINGS_KEY]: { followLight: false } });
    await settle();
    expect(obr.items.every((i) => i.metadata[DF_LIGHT_KEY] === undefined)).toBe(true);
    off();
  });

  it("players' clients never write", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a")];
    obr.metadata = { [LIGHTS_KEY]: { lights: [ourLight("a", "spent")] } };
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } };
    const off = watchDarkness();
    await settle();
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    expect(OBR.scene.items.updateItems).not.toHaveBeenCalled();
    off();
  });

  it("stops when unsubscribed", async () => {
    const off = await start([]);
    off();
    vi.mocked(OBR.scene.items.getItems).mockClear();
    await setItems([token("a")]);
    await settle();
    expect(OBR.scene.items.getItems).not.toHaveBeenCalled();
  });
});

// Starts the watch without waiting on real timers (for fake-timer tests).
const watchDarknessWith = (lights: object[]) => {
  obr.role = "GM";
  obr.items = [token("a"), token("b")];
  obr.metadata = { [LIGHTS_KEY]: { lights } };
  obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }] } };
  return watchDarkness();
};
