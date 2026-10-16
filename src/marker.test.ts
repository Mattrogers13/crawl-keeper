import { describe, it, expect } from "vitest";
import OBR, { type Image } from "@owlbear-rodeo/sdk";

import { MARKER_KEY, TRACKER_KEY } from "./constants";
import { buildMarker, markedToken, markerImage, planMarker, syncTurn, syncTurnFromScene } from "./marker";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, token } from "./test/obrMock";

const IMG = markerImage();
const markers = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined);
const ON = { showMarker: true, selectOnTurn: true };

describe("planMarker", () => {
  it("adds a marker to the token when it has none", () => {
    expect(planMarker([], "a", IMG)).toEqual({ remove: [], addTo: "a" });
  });

  it("keeps one current marker; strays, duplicates and old art go", () => {
    const plan = planMarker(
      [
        { id: "m1", attachedTo: "b", image: IMG },
        { id: "m2", attachedTo: "a", image: "old.webp" },
        { id: "m3", attachedTo: "a", image: IMG },
        { id: "m4", attachedTo: "a", image: IMG },
      ],
      "a",
      IMG,
    );
    expect(plan).toEqual({ remove: ["m1", "m2", "m4"], addTo: null });
  });

  it("no token: every marker goes", () => {
    expect(planMarker([{ id: "m1", attachedTo: "a", image: IMG }], null, IMG)).toEqual({ remove: ["m1"], addTo: null });
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
  });

  it("a token with a broken size gets a one-cell ring", () => {
    const t = token("a") as Image;
    t.grid = { dpi: 0, offset: { x: 0, y: 0 } };
    expect((buildMarker(t, IMG) as Image).grid.dpi).toBeCloseTo(256 / 1.5);
  });
});

describe("markedToken", () => {
  const t = parseTracker({
    entries: [{ id: "p" }, { id: GM_ENTRY }, { id: "m", monster: true }],
    phase: "combat",
    combatRound: 1,
  });
  it("players' tokens; monsters only when asked; never the GM row or between rounds", () => {
    expect(markedToken({ ...t, current: "p" }, false)).toBe("p");
    expect(markedToken({ ...t, current: "m" }, false)).toBeNull();
    expect(markedToken({ ...t, current: "m" }, true)).toBe("m");
    expect(markedToken({ ...t, current: GM_ENTRY }, true)).toBeNull();
    expect(markedToken({ ...t, current: null }, true)).toBeNull();
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

  it("respects the settings", async () => {
    obr.items = [token("a")];
    await syncTurn("a", { showMarker: false, selectOnTurn: false });
    expect(markers()).toEqual([]);
    expect(OBR.player.select).not.toHaveBeenCalled();
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
    await syncTurnFromScene({ showMarker: true, markMonsters: false });
    expect(markers().map((m) => m.attachedTo)).toEqual(["a"]);
    await syncTurnFromScene({ showMarker: false, markMonsters: false });
    expect(markers()).toEqual([]);
    expect(OBR.player.select).not.toHaveBeenCalled();
  });
});
