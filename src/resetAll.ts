// Settings → Reset all (Matt, 2026-11-06): a fresh session. This map's
// tracker goes back to the GM row alone (rounds, phase, clock and rolls
// reset; the danger level stays, it's the place), its effects go, and every
// light in the room goes (lights cross maps). One undo step. The scene is
// written first; if the lights then fail, the scene is put back.
import OBR from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { emptyEffects, parseEffects } from "./effects";
import type { Change } from "./history";
import { parseLights, type Lights } from "./lights";
import { afterChange } from "./marker";
import { logEvent } from "./sessionLog";
import { parseSettings } from "./settings";
import { emptyTracker, parseTracker, type Tracker } from "./tracker";
import { record } from "./undo";

// Pure: the tracker after a reset.
export const resetTracker = (t: Tracker): Tracker => {
  const fresh = emptyTracker();
  return { ...fresh, crawl: { ...fresh.crawl, danger: t.crawl.danger } };
};

// Pure: the lights after a reset (the lighting rule is a setting; it stays).
export const resetLights = (s: Lights): Lights => ({ ...s, paused: false, lights: [] });

export const resetAll = async () => {
  const [ready, room] = await Promise.all([OBR.scene.isReady(), OBR.room.getMetadata()]);
  const scene = ready ? await OBR.scene.getMetadata() : null;
  const changes: Change[] = [];
  let tracker: { before: Tracker; after: Tracker } | null = null;
  if (scene) {
    const before = parseTracker(scene[TRACKER_KEY]);
    const after = resetTracker(before);
    const fxBefore = parseEffects(scene[EFFECTS_KEY]);
    await OBR.scene.setMetadata({ [TRACKER_KEY]: after, [EFFECTS_KEY]: emptyEffects() });
    tracker = { before, after };
    changes.push({ store: "scene", key: TRACKER_KEY, before, after }, { store: "scene", key: EFFECTS_KEY, before: fxBefore, after: emptyEffects() });
  }
  const lightsBefore = parseLights(room[LIGHTS_KEY]);
  const lightsAfter = resetLights(lightsBefore);
  try {
    await OBR.room.setMetadata({ [LIGHTS_KEY]: lightsAfter });
  } catch (err) {
    if (scene) await OBR.scene.setMetadata({ [TRACKER_KEY]: scene[TRACKER_KEY], [EFFECTS_KEY]: scene[EFFECTS_KEY] });
    throw err;
  }
  changes.push({ store: "room", key: LIGHTS_KEY, before: lightsBefore, after: lightsAfter });
  if (tracker) await afterChange(tracker.before, tracker.after, parseSettings(room[SETTINGS_KEY]));
  await record("Reset all", changes, { toast: true });
  logEvent("Reset all: the tracker, effects and lights were cleared.", "session");
};
