import { describe, it, expect, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { toggleInitiative } from "./initiative";
import { HISTORY_KEY, MARKER_KEY, SCENE_ID_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { GM_ENTRY, parseTracker } from "./tracker";
import { clearHistory, loadHistory, onHistoryChange, record, redo, undo } from "./undo";
import { obr, setSceneReady, token } from "./test/obrMock";

const tracker = (current: string | null, round = 1) => ({ entries: [{ id: "a" }, { id: GM_ENTRY }], current, round });
const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);

describe("undo", () => {
  it("undo writes the step's before back, redo its after; the step moves between the stacks", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: tracker(GM_ENTRY, 2) };
    await record("Next turn", [{ store: "scene", key: TRACKER_KEY, before: tracker("a", 1), after: tracker(GM_ENTRY, 2) }]);
    expect(loadHistory().undo.map((s) => s.label)).toEqual(["Next turn"]);
    await undo();
    expect(saved()).toMatchObject({ current: "a", round: 1 });
    expect(loadHistory()).toMatchObject({ undo: [], redo: [{ label: "Next turn" }] });
    await redo();
    expect(saved()).toMatchObject({ current: GM_ENTRY, round: 2 });
    expect(loadHistory()).toMatchObject({ undo: [{ label: "Next turn" }], redo: [] });
  });

  it("a scene step tags the map with an id, written once", async () => {
    await record("A", [{ store: "scene", key: TRACKER_KEY, before: tracker("a"), after: tracker(GM_ENTRY) }]);
    const id = obr.sceneMetadata[SCENE_ID_KEY];
    expect(typeof id).toBe("string");
    await record("B", [{ store: "scene", key: TRACKER_KEY, before: tracker(GM_ENTRY), after: tracker("a") }]);
    expect(loadHistory().undo.map((s) => s.scene)).toEqual([id, id]);
  });

  it("a room-only step (settings) needs no map and restores the settings", async () => {
    obr.sceneReady = false;
    obr.metadata = { [SETTINGS_KEY]: { hideRound: true } };
    await record("Setting: hide rounds", [{ store: "room", key: SETTINGS_KEY, before: { hideRound: false }, after: { hideRound: true } }]);
    await undo();
    expect(obr.metadata[SETTINGS_KEY]).toEqual({ hideRound: false });
  });

  it("nothing changed: no step", async () => {
    await record("Sort by roll", [{ store: "scene", key: TRACKER_KEY, before: tracker("a"), after: tracker("a") }]);
    expect(loadHistory().undo).toEqual([]);
    expect(obr.sceneMetadata[SCENE_ID_KEY]).toBeUndefined();
  });

  it("a step from another map is skipped with a notice and dropped; that map isn't touched", async () => {
    obr.sceneMetadata = { [SCENE_ID_KEY]: "map-1", [TRACKER_KEY]: tracker(GM_ENTRY) };
    await record("Next turn", [{ store: "scene", key: TRACKER_KEY, before: tracker("a"), after: tracker(GM_ENTRY) }]);
    await setSceneReady(false);
    await setSceneReady(true, { metadata: { [SCENE_ID_KEY]: "map-2", [TRACKER_KEY]: tracker(null, 7) } });
    await undo();
    expect(saved()).toMatchObject({ current: null, round: 7 });
    expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("on another map"), "WARNING");
    expect(loadHistory()).toEqual({ undo: [], redo: [] });
  });

  it("no map open: a map step waits (kept) and says to open a map", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: tracker(GM_ENTRY) };
    await record("Next turn", [{ store: "scene", key: TRACKER_KEY, before: tracker("a"), after: tracker(GM_ENTRY) }]);
    await setSceneReady(false);
    await undo();
    expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("Open a map"), "WARNING");
    expect(loadHistory().undo).toHaveLength(1);
    await setSceneReady(true);
    await undo();
    expect(saved().current).toBe("a");
  });

  it("undo moves the turn marker back to the restored turn", async () => {
    obr.items = [token("a")];
    obr.sceneMetadata = { [TRACKER_KEY]: tracker(GM_ENTRY) };
    await record("Next turn", [{ store: "scene", key: TRACKER_KEY, before: tracker("a"), after: tracker(GM_ENTRY) }]);
    await undo();
    expect(obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo)).toEqual(["a"]);
  });

  it("two quick undos apply two steps, not the same one twice", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: tracker(GM_ENTRY, 3) };
    await record("1", [{ store: "scene", key: TRACKER_KEY, before: tracker("a", 1), after: tracker(GM_ENTRY, 2) }]);
    await record("2", [{ store: "scene", key: TRACKER_KEY, before: tracker(GM_ENTRY, 2), after: tracker(GM_ENTRY, 3) }]);
    await Promise.all([undo(), undo()]);
    expect(saved()).toMatchObject({ current: "a", round: 1 });
    expect(loadHistory().redo.map((s) => s.label)).toEqual(["2", "1"]);
  });

  it("a failed write keeps the step and says so", async () => {
    obr.metadata = { [SETTINGS_KEY]: { hideRound: true } };
    await record("Setting", [{ store: "room", key: SETTINGS_KEY, before: { hideRound: false }, after: { hideRound: true } }]);
    obr.failWrites = true;
    await undo();
    expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("Couldn't undo"), "ERROR");
    expect(loadHistory().undo).toHaveLength(1);
  });

  it("storage full: older steps go so the newest is kept", async () => {
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (v.length > 2000) throw new DOMException("full", "QuotaExceededError");
      real.call(this, k, v);
    });
    for (let i = 0; i < 20; i++) {
      await record(`Step ${i}`, [{ store: "room", key: SETTINGS_KEY, before: { i }, after: { i: i + 1 } }]);
    }
    const kept = loadHistory().undo;
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(20);
    expect(kept[kept.length - 1].label).toBe("Step 19");
    spy.mockRestore();
  });

  it("listeners hear about changes; storage that throws loses only the history", async () => {
    const heard = vi.fn();
    const off = onHistoryChange(heard);
    await record("A", [{ store: "room", key: SETTINGS_KEY, before: 1, after: 2 }]);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(loadHistory()).toEqual({ undo: [], redo: [] });
    await expect(undo()).resolves.toBeUndefined();
    vi.restoreAllMocks();
    expect(sessionStorage.getItem(HISTORY_KEY)).not.toBeNull();
  });

  it("a reload of the room (the background page starting) empties it", async () => {
    await record("A", [{ store: "room", key: SETTINGS_KEY, before: 1, after: 2 }]);
    clearHistory();
    expect(loadHistory()).toEqual({ undo: [], redo: [] });
  });

  it("the right-click menu records its step in the same history (removing offers the toast)", async () => {
    await toggleInitiative(["a"]);
    await toggleInitiative(["a"]);
    expect(loadHistory().undo.map((s) => [s.label, s.toast])).toEqual([
      ["Add to initiative", false],
      ["Remove from initiative", true],
    ]);
    await undo();
    expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY, "a"]);
  });
});
