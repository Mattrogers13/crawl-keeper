import { useEffect, useReducer } from "react";

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
// Writers: this panel, the right-click menu and undo, all the GM's own
// clicks reading fresh (like the tracker's right-click Add / Remove), so
// they don't overlap in practice. Burn-outs write nothing. `saved` runs once
// the write lands.
export type LightChange = (label: string, fn: (s: Lights, now: number) => Lights, opts?: { toast?: boolean; saved?: () => void }) => void;

export const useLights = () => {
  const doc = useRoomValue(LIGHTS_KEY, parseLights);
  const change: LightChange = (label, fn, opts) => {
    const before = doc.value;
    let after: Lights;
    try {
      after = fn(before, Date.now());
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    if (after === before) return;
    void doc.write(after).then((saved) => {
      if (!saved) return;
      void record(label, [{ store: "room", key: LIGHTS_KEY, before, after }], opts);
      opts?.saved?.();
    });
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
