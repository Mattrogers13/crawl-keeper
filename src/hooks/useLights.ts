import { useEffect, useReducer } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY } from "../constants";
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
export type LightChange = (label: string, fn: (s: Lights, now: number) => Lights, opts?: { toast?: boolean; saved?: () => void }) => void;

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
      if (after === before) return;
      if (!(await doc.write(after))) return;
      void record(label, [{ store: "room", key: LIGHTS_KEY, before, after }], opts);
      opts?.saved?.();
    };
    run().catch((err) => notify(`Couldn't change the lights: ${errorMessage(err)}`, "ERROR"));
  };
  return { loaded: doc.loaded, lights: doc.value, change };
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
