// The GM's undo / redo across the whole extension (docs/design.md, Torchlight
// merge: global undo). The history lives in sessionStorage: the panel is
// unloaded when the GM closes it, and the background page's right-click
// actions (same origin, same tab) add to the same history. Lost on reload.
// GM actions only; players never record.
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { HISTORY_KEY, SCENE_ID_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { EMPTY, afterUndo, afterRedo, parseHistory, pushStep, trim, type Change, type History, type Step } from "./history";
import { afterChange, syncTurnFromScene } from "./marker";
import { parseSettings } from "./settings";
import { readSession, writeSession } from "./storage";
import { parseTracker } from "./tracker";
import { errorMessage, notify } from "./utils";

// Same-document listeners (the storage event only reaches other documents).
const listeners = new Set<() => void>();

export const loadHistory = (): History => parseHistory(readSession(HISTORY_KEY));

const saveHistory = (h: History) => {
  // Full (about 5 MB; a step holds two tracker docs, up to ~12 kB each):
  // keep fewer old steps rather than lose the newest.
  let kept = h;
  while (!writeSession(HISTORY_KEY, JSON.stringify(kept)) && kept.undo.length > 1) {
    kept = trim(kept, Math.floor(kept.undo.length / 2));
  }
  listeners.forEach((l) => l());
};

// A new load of the room: nothing to undo.
export const clearHistory = () => saveHistory(EMPTY);

// Called on any change to the history, from this document or another (the
// background page records right-click actions). Returns the unsubscribe.
export const onHistoryChange = (listener: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === HISTORY_KEY) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const readSceneId = (metadata: Metadata) => {
  const id = metadata[SCENE_ID_KEY];
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? id : null;
};

// The open map's id, written the first time it's needed. (A duplicated map
// copies its metadata, id included; an undo step could then apply to the
// copy. Rare, and it only restores the GM's own earlier value.)
const ensureSceneId = async (): Promise<string> => {
  const existing = readSceneId(await OBR.scene.getMetadata());
  if (existing) return existing;
  const id = crypto.randomUUID();
  await OBR.scene.setMetadata({ [SCENE_ID_KEY]: id });
  return id;
};

// Record a GM action once it's saved. A failure here only loses the undo
// step, never the action.
export const record = async (label: string, changes: Change[], opts: { toast?: boolean } = {}) => {
  const real = changes.filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
  if (real.length === 0) return;
  try {
    const scene = real.some((c) => c.store === "scene") ? await ensureSceneId() : null;
    const step: Step = { id: crypto.randomUUID(), label, scene, changes: real, toast: opts.toast === true };
    saveHistory(pushStep(loadHistory(), step));
  } catch (err) {
    console.error(`Couldn't record "${label}" for undo: ${errorMessage(err)}`);
  }
};

const write = (store: "room" | "scene", update: Metadata) =>
  Object.keys(update).length === 0 ? Promise.resolve() : (store === "room" ? OBR.room : OBR.scene).setMetadata(update);

// Writes one side of a step. "other-map": the step belongs to another map
// (dropped); "no-map": no map is open right now (kept for later).
const apply = async (step: Step, side: "before" | "after"): Promise<"ok" | "other-map" | "no-map"> => {
  const [room, scene] = await Promise.all([
    OBR.room.getMetadata(),
    step.scene ? OBR.scene.isReady().then((ready) => (ready ? OBR.scene.getMetadata() : null)) : null,
  ]);
  if (step.scene && scene === null) return "no-map";
  if (step.scene && readSceneId(scene!) !== step.scene) return "other-map";
  const updates: Record<"room" | "scene", Metadata> = { room: {}, scene: {} };
  for (const c of step.changes) updates[c.store][c.key] = c[side];
  await write("room", updates.room);
  await write("scene", updates.scene);
  // Put the map in line with what's restored: the ring, the skulls, and the
  // marker setting. (A GM click, so the marker may move: marker.ts.)
  const settingsBefore = parseSettings(room[SETTINGS_KEY]);
  const settings = SETTINGS_KEY in updates.room ? parseSettings(updates.room[SETTINGS_KEY]) : settingsBefore;
  if (scene && TRACKER_KEY in updates.scene) {
    await afterChange(parseTracker(scene[TRACKER_KEY]), parseTracker(updates.scene[TRACKER_KEY]), settings);
  }
  if (settings.showMarker !== settingsBefore.showMarker) await syncTurnFromScene(settings);
  return "ok";
};

// One at a time: a second Cmd+Z while the first is still writing waits its
// turn instead of applying the same step twice.
let queue: Promise<unknown> = Promise.resolve();

const step = (direction: "undo" | "redo") => {
  const run = async () => {
    const h = loadHistory();
    const stack = direction === "undo" ? h.undo : h.redo;
    const s = stack[stack.length - 1];
    if (!s) return;
    try {
      const result = await apply(s, direction === "undo" ? "before" : "after");
      if (result === "no-map") {
        notify(`Open a map to ${direction} "${s.label}".`, "WARNING");
        return;
      }
      const ok = result === "ok";
      if (!ok) notify(`Couldn't ${direction} "${s.label}": it was on another map. Skipped.`, "WARNING");
      // Re-read: the background page may have recorded meanwhile.
      const now = loadHistory();
      saveHistory(direction === "undo" ? afterUndo(now, s, ok) : afterRedo(now, s, ok));
    } catch (err) {
      notify(`Couldn't ${direction}: ${errorMessage(err)}`, "ERROR");
    }
  };
  queue = queue.then(run, run);
  return queue as Promise<void>;
};

export const undo = () => step("undo");
export const redo = () => step("redo");
