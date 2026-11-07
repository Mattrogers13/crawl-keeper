// The GM's Party / Split switch (the panel's button): reads the room and the
// map fresh, plans it (partySwitch.ts), saves the lights then the tracker as
// one undo step, then shows and hides the tokens (marker.ts afterChange, which
// undo runs too). The lights go first so the map is never left dark; if the
// tracker then fails to save, the lights go back.
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { parseLights } from "./lights";
import { afterChange, readSettings } from "./marker";
import { carriers, planSwitch } from "./partySwitch";
import { parseTracker } from "./tracker";
import { record } from "./undo";
import { errorMessage, notify } from "./utils";

export type Choice = { id: string; name: string };

// `pick`: the carrier chosen for a split. Returns who to ask when a light
// needs one, else null (it's done, or a failure was told).
export const switchParty = async (together: boolean, pick?: string): Promise<Choice[] | null> => {
  const [scene, room, settings] = await Promise.all([OBR.scene.getMetadata(), OBR.room.getMetadata(), readSettings()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const lights = parseLights(room[LIGHTS_KEY]);
  if (tracker.party === null) return null;
  const items = await OBR.scene.items.getItems([tracker.party, ...carriers(tracker)]);
  const names = new Map(items.map((i) => [i.id, i.name?.trim() || "Unnamed"]));
  const nameOf = (id: string) => names.get(id) ?? "Unnamed";
  const plan = planSwitch(tracker, lights, Date.now(), together, nameOf, pick);
  if (!plan.done) return plan.choices.map((id) => ({ id, name: nameOf(id) }));
  if (plan.tracker === tracker && plan.lights === lights) return null;
  const lightsChanged = plan.lights !== lights;
  try {
    if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: plan.lights });
    try {
      await OBR.scene.setMetadata({ [TRACKER_KEY]: plan.tracker });
    } catch (err) {
      if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: lights }).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    notify(`Couldn't ${together ? "bring the party together" : "split the party"}: ${errorMessage(err)}`, "WARNING");
    return null;
  }
  await record(together ? "Party together" : "Split the party", [
    ...(lightsChanged ? [{ store: "room" as const, key: LIGHTS_KEY, before: lights, after: plan.lights }] : []),
    { store: "scene" as const, key: TRACKER_KEY, before: scene[TRACKER_KEY], after: plan.tracker },
  ]);
  await afterChange(tracker, plan.tracker, settings);
  if (plan.stayed > 0) notify(`${plan.stayed} light${plan.stayed === 1 ? "" : "s"} stayed put: that token already burns one.`, "WARNING");
  return null;
};
