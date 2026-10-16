import { describe, it, expect } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { COMBAT_ALERT, createMenu, toggleInitiative, watchCombat } from "./background";
import { MARKER_KEY, TRACKER_KEY } from "./constants";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, setSceneReady, token, writeSceneFromElsewhere } from "./test/obrMock";

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

  it("registers a GM-only menu on character and mount images", async () => {
    await createMenu();
    const menu = vi.mocked(OBR.contextMenu.create).mock.calls[0][0];
    expect(menu.icons[0].filter?.roles).toEqual(["GM"]);
    expect(menu.icons[0].icon).toBe("/img/initiative.svg");
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
