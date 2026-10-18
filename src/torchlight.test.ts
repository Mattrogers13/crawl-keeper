import { describe, it, expect, vi } from "vitest";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { emptyCrawl, lightsBack, lightsOut, type Crawl } from "./crawl";
import {
  DF_LIGHT_KEY,
  DIM_KEY,
  TORCHLIGHT_TOKEN_KEY,
  anyLit,
  dimLight,
  feetToPx,
  lightOn,
  planDim,
  watchTorchlight,
} from "./torchlight";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, setItems, token } from "./test/obrMock";

const crawl = (c: Partial<Crawl> = {}): Crawl => ({ ...emptyCrawl(), ...c });
const lit = (id: string, source: unknown = "torch", extra: Partial<Item> = {}) => ({
  ...token(id, extra),
  metadata: { [TORCHLIGHT_TOKEN_KEY]: { source, saved: null } },
});
const doc = (entries: object[]) => parseTracker({ entries });
// 3 ft on Owlbear's default 5 ft grid at 150 dpi.
const DIM_PX = 90;

describe("lights out and back (crawl rules)", () => {
  it("lights out: total darkness, Deadly, the old danger kept", () => {
    expect(lightsOut(crawl({ danger: "risky" }))).toMatchObject({ dark: true, danger: "deadly", dangerBeforeDark: "risky" });
    // Already Deadly: nothing to put back.
    expect(lightsOut(crawl({ danger: "deadly" }))).toMatchObject({ dark: true, dangerBeforeDark: null });
    const out = lightsOut(crawl());
    expect(lightsOut(out)).toBe(out);
  });

  it("lights back: the old danger returns, unless the GM changed it meanwhile", () => {
    expect(lightsBack(lightsOut(crawl({ danger: "unsafe" })))).toMatchObject({ dark: false, danger: "unsafe", dangerBeforeDark: null });
    expect(lightsBack({ ...lightsOut(crawl({ danger: "unsafe" })), danger: "risky" })).toMatchObject({ dark: false, danger: "risky" });
    const plain = crawl();
    expect(lightsBack(plain)).toBe(plain);
  });
});

describe("reading Torchlight", () => {
  it("a token's light; an unknown source still counts; untracked tokens don't", () => {
    expect(lightOn(lit("a", "lantern"))).toBe("lantern");
    expect(lightOn(lit("a", "bonfire"))).toBe("torch");
    expect(lightOn(token("a"))).toBeNull();
    const t = doc([{ id: "a" }, { id: GM_ENTRY }]);
    expect(anyLit(t, [lit("b")])).toBe(false);
    expect(anyLit(t, [lit("a"), token("b")])).toBe(true);
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

describe("watchTorchlight (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
  const start = async (items: Item[], danger = "risky") => {
    obr.role = "GM";
    obr.items = items;
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], crawl: { danger } } };
    const off = watchTorchlight();
    await settle();
    return off;
  };

  it("the last light out: darkness, Deadly and dim lights on the party; the first back undoes it all", async () => {
    const off = await start([lit("a"), token("b")]);
    // Starting up lit changes nothing.
    expect(saved().crawl).toMatchObject({ dark: false, danger: "risky" });
    await setItems([token("a"), token("b")]);
    await settle();
    expect(saved().crawl).toMatchObject({ dark: true, danger: "deadly", dangerBeforeDark: "risky" });
    expect(obr.items.map((i) => (i.metadata[DF_LIGHT_KEY] as { attenuationRadius?: number })?.attenuationRadius)).toEqual([DIM_PX, DIM_PX]);
    // Torchlight lights "a" (keeping our dim light to put back).
    await setItems([
      { ...obr.items[0], metadata: { ...obr.items[0].metadata, [DF_LIGHT_KEY]: dimLight(900), [TORCHLIGHT_TOKEN_KEY]: { source: "torch", saved: dimLight(DIM_PX) } } },
      obr.items[1],
    ]);
    await settle();
    expect(saved().crawl).toMatchObject({ dark: false, danger: "risky" });
    expect(obr.items[1].metadata[DF_LIGHT_KEY]).toBeUndefined();
    expect(obr.items[0].metadata[DF_LIGHT_KEY]).toEqual(dimLight(900));
    // Its torch burns out while another light burns: Torchlight puts our dim light back, we take it off.
    await setItems([
      { ...token("a"), metadata: { [DF_LIGHT_KEY]: dimLight(DIM_PX), [DIM_KEY]: true } },
      lit("b"),
    ]);
    await settle();
    expect(obr.items[0].metadata).toEqual({});
    off();
  });

  it("a room without Torchlight never goes dark", async () => {
    const off = await start([token("a"), token("b")]);
    await setItems([token("a"), token("b"), token("c")]);
    await settle();
    expect(saved().crawl.dark).toBe(false);
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    off();
  });

  it("setting off: no darkness, and its dim lights come off", async () => {
    const off = await start([lit("a"), token("b")]);
    await setItems([token("a"), token("b")]);
    await settle();
    expect(saved().crawl.dark).toBe(true);
    obr.metadata = { [SETTINGS_KEY]: { followTorchlight: false } };
    await setItems([...obr.items]);
    await settle();
    expect(obr.items.every((i) => i.metadata[DF_LIGHT_KEY] === undefined)).toBe(true);
    off();
  });

  it("players' clients never write", async () => {
    obr.role = "PLAYER";
    obr.items = [lit("a")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } };
    const off = watchTorchlight();
    await settle();
    await setItems([token("a")]);
    await settle();
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
    expect(OBR.scene.items.updateItems).not.toHaveBeenCalled();
    off();
  });

  it("stops when unsubscribed", async () => {
    const off = await start([lit("a")]);
    off();
    vi.mocked(OBR.scene.items.getItems).mockClear();
    await setItems([token("a")]);
    await settle();
    expect(OBR.scene.items.getItems).not.toHaveBeenCalled();
  });
});
