import { describe, it, expect, vi } from "vitest";
import OBR, { type Image } from "@owlbear-rodeo/sdk";

import { MARKER_KEY, SKULL_KEY, TRACKER_KEY } from "./constants";
import {
  afterChange,
  buildMarker,
  buildSkull,
  markedToken,
  markerImage,
  markerVisibilityFixes,
  planMarker,
  planSkulls,
  skullImage,
  syncSkulls,
  syncTurn,
  syncTurnFromScene,
} from "./marker";
import { GM_ENTRY, parseTracker, setDead } from "./tracker";
import { obr, token } from "./test/obrMock";

const IMG = markerImage();
const markers = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined);
const ON = { showMarker: true, selectOnTurn: true };
// A real ring (what buildMarker makes), attached to `to`.
const realRing = (id: string, to: string, visible: boolean) => ({ ...buildMarker(token(to) as Image, IMG), id, visible });

describe("planMarker", () => {
  const A = { id: "a", visible: true };
  const ring = (id: string, attachedTo: string, image = IMG, visible = true) => ({ id, attachedTo, image, visible });

  it("adds a marker to the token when it has none", () => {
    expect(planMarker([], A, IMG)).toEqual({ remove: [], addTo: "a" });
  });

  it("keeps one current marker; strays, duplicates and old art go", () => {
    const plan = planMarker([ring("m1", "b"), ring("m2", "a", "old.webp"), ring("m3", "a"), ring("m4", "a")], A, IMG);
    expect(plan).toEqual({ remove: ["m1", "m2", "m4"], addTo: null });
  });

  it("a ring whose visibility differs from its token's is replaced", () => {
    expect(planMarker([ring("m1", "a", IMG, true)], { id: "a", visible: false }, IMG)).toEqual({ remove: ["m1"], addTo: "a" });
  });

  it("no token: every marker goes", () => {
    expect(planMarker([ring("m1", "a")], null, IMG)).toEqual({ remove: ["m1"], addTo: null });
  });
});

describe("markerVisibilityFixes", () => {
  it("rings follow their token's visibility; other items are left alone", () => {
    const hidden = token("h", { visible: false });
    const shown = token("s");
    const rings = [realRing("r1", "h", true), realRing("r2", "s", true), { ...token("x"), attachedTo: "h", visible: true }];
    expect(markerVisibilityFixes([hidden, shown, ...rings])).toEqual([{ id: "r1", visible: false }]);
  });

  it("a hidden item merely tagged as a marker is never shown", () => {
    const shown = token("s");
    const tagged = { ...token("secret"), attachedTo: "s", visible: false, metadata: { [MARKER_KEY]: true } };
    const foreign = { ...realRing("r", "s", false), image: { ...realRing("r", "s", false).image, url: "https://elsewhere.example/img/turn-marker.webp" } };
    expect(markerVisibilityFixes([shown, tagged, foreign])).toEqual([]);
  });
});

describe("planSkulls", () => {
  const SK = "https://x/skull.webp";
  const skull = (id: string, attachedTo: string, image = SK, visible = true) => ({ id, attachedTo, image, visible });

  it("one current skull per dead token; the living lose theirs; duplicates and old art go", () => {
    const plan = planSkulls(
      [skull("s1", "a"), skull("s2", "a"), skull("s3", "b"), skull("s4", "c", "old.webp"), skull("s5", "d", SK, true)],
      [{ id: "a", visible: true }, { id: "c", visible: true }, { id: "d", visible: false }, { id: "e", visible: true }],
      SK,
    );
    expect(plan).toEqual({ remove: ["s2", "s3", "s4", "s5"], addTo: ["c", "d", "e"] });
  });
});

describe("buildSkull", () => {
  it("is a locked badge over the token's centre, half its width", () => {
    // 2 cells wide: a 1-cell badge centred on the token.
    const t = token("a", { position: { x: 40, y: 60 } }) as Image;
    t.image = { ...t.image, width: 200, height: 200 };
    t.grid = { dpi: 100, offset: { x: 100, y: 100 } };
    const s = buildSkull(t, skullImage()) as Image & Record<string, unknown>;
    const pxPerCell = s.grid.dpi;
    expect(256 / pxPerCell).toBeCloseTo(1);
    expect(s.grid.offset).toEqual({ x: 128, y: 128 });
    expect(s).toMatchObject({ attachedTo: "a", layer: "ATTACHMENT", locked: true, disableHit: true, position: { x: 40, y: 60 } });
    expect(s.metadata).toEqual({ [SKULL_KEY]: true });
    expect((buildSkull({ ...t, visible: false }, skullImage()) as Image).visible).toBe(false);
  });
});

describe("syncSkulls", () => {
  const skulls = () => obr.items.filter((i) => i.metadata[SKULL_KEY] !== undefined);

  it("puts a skull on each dead token and takes it off when they're alive again", async () => {
    obr.items = [token("a"), token("b", { visible: false })];
    await syncSkulls(["a", "b", "gone"]);
    expect(skulls().map((s) => [s.attachedTo, s.visible])).toEqual([["a", true], ["b", false]]);
    await syncSkulls(["b"]);
    expect(skulls().map((s) => s.attachedTo)).toEqual(["b"]);
    // Nothing to change: no writes.
    vi.mocked(OBR.scene.items.addItems).mockClear();
    await syncSkulls(["b"]);
    expect(OBR.scene.items.addItems).not.toHaveBeenCalled();
  });

  it("never deletes a token merely tagged as a skull", async () => {
    obr.items = [token("a"), { ...token("boss"), metadata: { [SKULL_KEY]: true } }];
    await syncSkulls([]);
    expect(obr.items.map((i) => i.id)).toContain("boss");
  });

  it("afterChange syncs the skulls only when who's dead changed", async () => {
    obr.items = [token("a")];
    const before = parseTracker({ entries: [{ id: "a" }, { id: GM_ENTRY }] });
    const off = { showMarker: false, selectOnTurn: false };
    await afterChange(before, before, off);
    expect(OBR.scene.items.getItems).not.toHaveBeenCalled();
    await afterChange(before, setDead(before, ["a"], true), off);
    expect(skulls().map((s) => s.attachedTo)).toEqual(["a"]);
  });
});

describe("buildMarker", () => {
  it("is a locked, unclickable WebP attachment sized past the token's footprint", () => {
    // 2 cells wide (200 px at 100 dpi), scaled 1.5 = 3 cells; ring is 1.5x that.
    const t = token("a", { scale: { x: 1.5, y: 1.5 }, position: { x: 40, y: 60 } }) as Image;
    t.image = { ...t.image, width: 200, height: 200 };
    t.grid = { dpi: 100, offset: { x: 100, y: 100 } };
    const m = buildMarker(t, IMG) as Image & Record<string, unknown>;
    expect(m.image).toMatchObject({ url: IMG, mime: "image/webp", width: 256 });
    expect(m.grid.dpi).toBeCloseTo(256 / (3 * 1.5));
    expect(m).toMatchObject({ attachedTo: "a", layer: "ATTACHMENT", locked: true, disableHit: true, position: { x: 40, y: 60 } });
    expect(m.disableAttachmentBehavior).toEqual(["ROTATION", "COPY"]);
    expect(m.metadata).toEqual({ [MARKER_KEY]: true });
    expect(m.visible).toBe(true);
    expect((buildMarker({ ...t, visible: false }, IMG) as Image).visible).toBe(false);
  });

  it("a token with a broken size gets a one-cell ring", () => {
    const t = token("a") as Image;
    t.grid = { dpi: 0, offset: { x: 0, y: 0 } };
    expect((buildMarker(t, IMG) as Image).grid.dpi).toBeCloseTo(256 / 1.5);
  });
});

describe("markedToken", () => {
  const t = parseTracker({
    entries: [{ id: "p" }, { id: GM_ENTRY }, { id: "m", monster: true }, { id: "boss", monster: true, marker: true }],
    phase: "combat",
    round: 1,
  });
  it("tokens whose marker is on; never the GM row or between rounds", () => {
    expect(markedToken({ ...t, current: "p" })).toBe("p");
    expect(markedToken({ ...t, current: "m" })).toBeNull();
    expect(markedToken({ ...t, current: "boss" })).toBe("boss");
    expect(markedToken({ ...t, current: GM_ENTRY })).toBeNull();
    expect(markedToken({ ...t, current: null })).toBeNull();
  });
});

describe("syncTurn", () => {
  it("moves the one marker to the current token and selects it", async () => {
    obr.items = [token("a"), token("b")];
    await syncTurn("a", ON);
    await syncTurn("b", ON);
    expect(markers().map((m) => m.attachedTo)).toEqual(["b"]);
    expect(obr.selection).toEqual(["b"]);
  });

  it("the GM row or no turn: no marker, selection left alone", async () => {
    obr.items = [token("a")];
    await syncTurn("a", ON);
    await syncTurn(GM_ENTRY, ON);
    expect(markers()).toEqual([]);
    expect(obr.selection).toEqual(["a"]);
    await syncTurn(null, ON);
    expect(markers()).toEqual([]);
  });

  it("never deletes a token merely tagged as a marker", async () => {
    const tagged = { ...token("boss"), metadata: { [MARKER_KEY]: true } };
    obr.items = [token("a"), tagged];
    await syncTurn("a", ON);
    await syncTurn(null, ON);
    expect(obr.items.map((i) => i.id)).toContain("boss");
    expect(OBR.scene.items.deleteItems).not.toHaveBeenCalledWith(expect.arrayContaining(["boss"]));
  });

  it("respects the settings", async () => {
    obr.items = [token("a")];
    await syncTurn("a", { showMarker: false, selectOnTurn: false });
    expect(markers()).toEqual([]);
    expect(OBR.player.select).not.toHaveBeenCalled();
  });

  it("overlapping syncs (quick clicks) run one at a time: one ring, no double delete", async () => {
    obr.items = [token("a"), token("b")];
    await syncTurn("a", ON);
    vi.mocked(OBR.scene.items.deleteItems).mockClear();
    await Promise.all([syncTurn("b", ON), syncTurn("b", ON)]);
    expect(markers().map((m) => m.attachedTo)).toEqual(["b"]);
    expect(OBR.scene.items.deleteItems).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the token is unchanged and marked", async () => {
    obr.items = [token("a")];
    await syncTurn("a", ON);
    await syncTurn("a", ON);
    expect(OBR.scene.items.addItems).toHaveBeenCalledTimes(1);
    expect(OBR.scene.items.deleteItems).not.toHaveBeenCalled();
  });

  it("a settings change adds or removes the marker for the current turn", async () => {
    obr.items = [token("a")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }], current: "a", round: 1 } };
    await syncTurnFromScene({ showMarker: true });
    expect(markers().map((m) => m.attachedTo)).toEqual(["a"]);
    await syncTurnFromScene({ showMarker: false });
    expect(markers()).toEqual([]);
    expect(OBR.player.select).not.toHaveBeenCalled();
  });
});
