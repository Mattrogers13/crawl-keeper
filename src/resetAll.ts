// Settings → Reset all (Matt, 2026-11-06): a fresh session. This map's
// tracker goes back to the GM row alone (rounds, phase, clock and rolls
// reset, the danger level back to Unsafe), its effects go (and their
// map icons), the lights on the tracker's tokens go (a campfire prop not in
// initiative keeps burning), and the session log is cleared (the panel
// offers a download first). One undo step for the tracker, effects and
// lights; the log can't come back. The scene is written first; if the
// lights then fail, the scene is put back.
import OBR from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { emptyEffects, parseEffects } from "./effects";
import type { Change } from "./history";
import { parseLights, type Lights } from "./lights";
import { afterChange } from "./marker";
import { clearLog, logEvent, readLog, replaceLog } from "./sessionLog";
import { parseSettings } from "./settings";
import { emptyTracker, parseTracker, type Tracker } from "./tracker";
import { record } from "./undo";

// Pure: the tracker after a reset: as new (the danger level back to Unsafe
// too, Matt 2026-11-06).
export const resetTracker = (): Tracker => emptyTracker();

// Pure: the lights after a reset: those on the tracker's tokens go (the
// lighting rule is a setting; it stays). Paused only while lights remain.
export const resetLights = (s: Lights, tracked: Set<string>): Lights => {
  const lights = s.lights.filter((l) => !tracked.has(l.tokenId));
  return { ...s, paused: lights.length > 0 && s.paused, lights };
};

export const resetAll = async () => {
  // A new log starts with the reset, before the writes so the background's
  // "… removed" lines land after it; the old log comes back if it fails.
  const oldLog = readLog();
  clearLog();
  logEvent("Reset all: a new session. The tracker, effects and the tracker's lights were cleared.", "session");
  try {
    await reset();
  } catch (err) {
    replaceLog(oldLog);
    throw err;
  }
};

const reset = async () => {
  const [ready, room] = await Promise.all([OBR.scene.isReady(), OBR.room.getMetadata()]);
  const scene = ready ? await OBR.scene.getMetadata() : null;
  const changes: Change[] = [];
  let tracker: { before: Tracker; after: Tracker } | null = null;
  if (scene) {
    const before = parseTracker(scene[TRACKER_KEY]);
    const after = resetTracker();
    const fxBefore = parseEffects(scene[EFFECTS_KEY]);
    await OBR.scene.setMetadata({ [TRACKER_KEY]: after, [EFFECTS_KEY]: emptyEffects() });
    tracker = { before, after };
    changes.push({ store: "scene", key: TRACKER_KEY, before, after }, { store: "scene", key: EFFECTS_KEY, before: fxBefore, after: emptyEffects() });
  }
  const lightsBefore = parseLights(room[LIGHTS_KEY]);
  const tracked = new Set(tracker ? tracker.before.entries.map((e) => e.id) : []);
  const lightsAfter = resetLights(lightsBefore, tracked);
  try {
    await OBR.room.setMetadata({ [LIGHTS_KEY]: lightsAfter });
  } catch (err) {
    if (scene) await OBR.scene.setMetadata({ [TRACKER_KEY]: scene[TRACKER_KEY], [EFFECTS_KEY]: scene[EFFECTS_KEY] });
    throw err;
  }
  changes.push({ store: "room", key: LIGHTS_KEY, before: lightsBefore, after: lightsAfter });
  if (tracker) await afterChange(tracker.before, tracker.after, parseSettings(room[SETTINGS_KEY]));
  await record("Reset all", changes);
};
