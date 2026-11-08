import { useEffect, useReducer } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, LIGHTS_KEY } from "../constants";
import { parseEffects, type Effects } from "../effects";
import type { Change as HistoryChange } from "../history";
import { lightStatus, msToNextBurnOut, parseLights, type Lights } from "../lights";
import { record } from "../undo";
import { errorMessage, notify } from "../utils";
import { useRoomValue } from "./useRoomValue";

// The light timers (room metadata) and the GM's way to change them: a pure
// change from lights.ts, applied at the time of the click, saved, then an
// undo step named `label`. A change the rules refuse (they throw) is told,
// not saved.
//
// Writers: this panel, the right-click menu, undo, and the GM's background
// answering players (playerLights.ts). Each reads the room fresh at the
// moment it writes, so a player's light lit a moment ago isn't overwritten
// by what the panel last saw. Burn-outs write nothing. `saved` runs once the
// write lands.
//
// `effects`: a change to the open map's effects in the same undo step (Time
// passes ends rounds effects, p. 82). The lights are saved first (room),
// then the effects (scene); if the effects fail, the lights go back.
export type LightChange = (
  label: string,
  fn: (s: Lights, now: number) => Lights,
  opts?: { toast?: boolean; saved?: () => void; effects?: (e: Effects) => Effects },
) => void;

// The open map's effects and their change, if there's a map and a change.
const effectsChange = async (fn: ((e: Effects) => Effects) | undefined) => {
  if (!fn || !(await OBR.scene.isReady())) return null;
  const before = parseEffects((await OBR.scene.getMetadata())[EFFECTS_KEY]);
  const after = fn(before);
  return after === before ? null : { before, after };
};

export const useLights = () => {
  const doc = useRoomValue(LIGHTS_KEY, parseLights);
  const change: LightChange = (label, fn, opts) => {
    const run = async () => {
      const before = parseLights((await OBR.room.getMetadata())[LIGHTS_KEY]);
      let after: Lights;
      try {
        after = fn(before, Date.now());
      } catch (err) {
        notify(errorMessage(err), "WARNING");
        return;
      }
      const effects = await effectsChange(opts?.effects);
      if (after === before && !effects) return;
      const changes: HistoryChange[] = [];
      if (after !== before) {
        if (!(await doc.write(after))) return;
        changes.push({ store: "room", key: LIGHTS_KEY, before, after });
      }
      if (effects) {
        try {
          await OBR.scene.setMetadata({ [EFFECTS_KEY]: effects.after });
          changes.push({ store: "scene", key: EFFECTS_KEY, before: effects.before, after: effects.after });
        } catch (err) {
          if (after !== before) await doc.write(before);
          notify(`Couldn't change this map's effects, so nothing changed: ${errorMessage(err)}`, "ERROR");
          return;
        }
      }
      void record(label, changes, opts);
      opts?.saved?.();
    };
    run().catch((err) => notify(`Couldn't change the lights: ${errorMessage(err)}`, "ERROR"));
  };
  // An automatic change: read fresh, apply, save; no undo step and no toast
  // (spent lights leaving at the next turn).
  const quiet = (fn: (s: Lights) => Lights) => {
    const run = async () => {
      const before = parseLights((await OBR.room.getMetadata())[LIGHTS_KEY]);
      const after = fn(before);
      if (after !== before) await doc.write(after);
    };
    run().catch((err) => console.warn(`Couldn't tidy the lights: ${errorMessage(err)}`));
  };
  return { loaded: doc.loaded, lights: doc.value, change, quiet };
};

// "none" / "lit" / "dark", re-read when the next lit light burns out, so a
// burn-out shows without a write or a ticking re-render.
export const useLightStatus = (lights: Lights) => {
  const [, wake] = useReducer((n: number) => n + 1, 0);
  const now = Date.now();
  const next = msToNextBurnOut(lights, now);
  useEffect(() => {
    if (next === null) return;
    const t = setTimeout(wake, next + 50);
    return () => clearTimeout(t);
  }, [lights, next]);
  return lightStatus(lights, now);
};
