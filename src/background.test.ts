import { describe, it, expect } from "vitest";
import OBR, { type Image } from "@owlbear-rodeo/sdk";

import { COMBAT_ALERT, createMenu, watchCombat, watchMarkerVisibility } from "./background";
import { toggleInitiative } from "./initiative";
import { MARKER_KEY, TRACKER_KEY } from "./constants";
import { buildMarker, buildSkull, markerImage, skullImage } from "./marker";
import { GM_ENTRY, parseTracker } from "./tracker";
import { changePlayer, obr, setItems, setSceneReady, token, writeSceneFromElsewhere } from "./test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);

describe("background: Add / Remove Initiative", () => {
  it("adds untracked tokens, then removes them on a second click", async () => {
    await toggleInitiative(["a", "b"]);
    expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY, "a", "b"]);
    await toggleInitiative(["a", "b"]);
    expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY]);
  });

  it("reads the scene fresh and keeps malformed data out", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "x", roll: 3 }, "junk"], current: "x", round: 2 } };
    await toggleInitiative(["y"]);
    expect(saved()).toMatchObject({ current: "x", round: 2 });
    expect(saved().entries.map((e) => e.id)).toEqual(["x", GM_ENTRY, "y"]);
  });

  it("removing the current token moves the turn and the marker on", async () => {
    obr.items = [token("a"), token("b")];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], current: "a", round: 1 } };
    await toggleInitiative(["a"]);
    expect(saved().current).toBe("b");
    expect(obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo)).toEqual(["b"]);
  });

  it("tells the GM when the tracker is full instead of dropping tokens quietly", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: Array.from({ length: 38 }, (_, i) => ({ id: `t${i}` })) } };
    await toggleInitiative(["x", "y", "z"]);
    expect(saved().entries).toHaveLength(40);
    // 38 tokens + the GM row: room for one more.
    expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("2 tokens not added"), "WARNING");
  });

  it("a failed save doesn't also claim the tokens that fit were added", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: Array.from({ length: 38 }, (_, i) => ({ id: `t${i}` })) } };
    obr.failWrites = true;
    await expect(toggleInitiative(["x", "y", "z"])).rejects.toThrow();
    expect(OBR.notification.show).not.toHaveBeenCalledWith(expect.stringContaining("not added"), "WARNING");
  });

  it("registers one GM-only Crawl Keeper item on character, mount and prop images, opening the submenu", async () => {
    await createMenu();
    const menus = vi.mocked(OBR.contextMenu.create).mock.calls.map((c) => c[0]);
    expect(menus).toHaveLength(1);
    expect(menus[0].icons[0]).toMatchObject({ label: "Crawl Keeper", icon: "/img/initiative.svg" });
    expect(menus[0].icons[0].filter?.roles).toEqual(["GM"]);
    expect(menus[0].icons[0].filter?.every?.map((f) => f.value)).toEqual(["CHARACTER", "MOUNT", "PROP", "IMAGE"]);
    expect(menus[0].embed).toEqual({ url: "/menu", height: 6 * 36 + 8 });
  });
});

describe("background: combat alert", () => {
  const phase = (p: string) => ({ [TRACKER_KEY]: { entries: [], phase: p } });
  const alerts = () => vi.mocked(OBR.notification.show).mock.calls.filter(([m]) => m === COMBAT_ALERT);
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it("alerts everyone on a switch to combat, once", async () => {
    obr.sceneMetadata = phase("crawl");
    const off = watchCombat();
    await settle();
    await writeSceneFromElsewhere(phase("combat"));
    await writeSceneFromElsewhere(phase("combat"));
    expect(alerts()).toHaveLength(1);
    await writeSceneFromElsewhere(phase("crawl"));
    expect(alerts()).toHaveLength(1);
    off();
  });

  it("doesn't alert for a fight already on when the scene opens or the page loads", async () => {
    obr.sceneMetadata = phase("combat");
    const off = watchCombat();
    await settle();
    await writeSceneFromElsewhere(phase("combat"));
    await setSceneReady(false);
    await setSceneReady(true, { metadata: phase("combat") });
    await settle();
    await writeSceneFromElsewhere({ other: 1 });
    expect(alerts()).toHaveLength(0);
    off();
  });

  it("doesn't alert for an update that lands before the scene's phase is known", async () => {
    obr.sceneReady = false;
    const off = watchCombat();
    await settle();
    await writeSceneFromElsewhere(phase("combat"));
    expect(alerts()).toHaveLength(0);
    off();
  });

  it("stops listening when unsubscribed", async () => {
    obr.sceneMetadata = phase("crawl");
    const off = watchCombat();
    await settle();
    off();
    await writeSceneFromElsewhere(phase("combat"));
    expect(alerts()).toHaveLength(0);
  });
});

describe("background: turn marker visibility", () => {
  const ring = (visible: boolean) => ({ ...buildMarker(token("a") as Image, markerImage()), id: "r", visible });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it("the GM's client hides the ring when its token is hidden, panel closed", async () => {
    obr.role = "GM";
    const off = watchMarkerVisibility();
    await settle();
    await setItems([token("a", { visible: false }), ring(true)]);
    await settle();
    expect(obr.items.find((i) => i.id === "r")?.visible).toBe(false);
    off();
  });

  it("the skull follows its token's visibility too", async () => {
    obr.role = "GM";
    const off = watchMarkerVisibility();
    await settle();
    await setItems([token("a", { visible: false }), { ...buildSkull(token("a") as Image, skullImage()), id: "s", visible: true }]);
    await settle();
    expect(obr.items.find((i) => i.id === "s")?.visible).toBe(false);
    off();
  });

  it("players' clients never write", async () => {
    obr.role = "PLAYER";
    const off = watchMarkerVisibility();
    await settle();
    await setItems([token("a", { visible: false }), ring(true)]);
    await settle();
    expect(OBR.scene.items.updateItems).not.toHaveBeenCalled();
    await changePlayer({ role: "GM" });
    await setItems([token("a", { visible: false }), ring(true)]);
    await settle();
    expect(OBR.scene.items.updateItems).toHaveBeenCalled();
    off();
  });
});
