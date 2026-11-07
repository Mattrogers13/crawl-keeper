// The GM's Party / Split switch (the panel's button): reads the room and the
// map fresh, plans it (partySwitch.ts), saves the lights then the tracker as
// one undo step, then moves the tokens (together: the Party token to the
// players' centre; split: the players back into their old shape around it,
// formation.ts) and shows and hides them (marker.ts afterChange, which undo
// runs too; undo doesn't move tokens back). The lights go first so the map is never left dark; if the
// tracker then fails to save, the lights go back.
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { parseLights } from "./lights";
import { combine, expand, type Move, type Placed } from "./formation";
import { afterChange, readSettings } from "./marker";
import { carriers, planSwitch } from "./partySwitch";
import { parseTracker, setFormation } from "./tracker";
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
  // Where the tokens stand now: each one's position, which for a token is its
  // centre (Owlbear places an image by its grid offset, the middle by
  // default). Read from the items already fetched, before anything changes:
  // no extra round trips that could stall the switch.
  const byId = new Map(items.map((i) => [i.id, i]));
  const here = (ids: string[]): Placed[] =>
    ids.flatMap((id) => {
      const i = byId.get(id);
      return i ? [{ id, center: { x: i.position.x, y: i.position.y } }] : [];
    });
  let move: Move = {};
  let moved = plan.tracker;
  try {
    const players = here(carriers(tracker));
    if (together) {
      const [party] = here([tracker.party]);
      if (party && players.length > 0) {
        const c = combine(party, players);
        move = c.move;
        moved = setFormation(plan.tracker, c.formation);
      }
    } else {
      const [party] = here([tracker.party]);
      if (party && players.length > 0) {
        const cell = await OBR.scene.grid.getDpi().catch(() => 150);
        move = expand(party.center, tracker.formation, players, cell);
      }
    }
  } catch (err) {
    notify(`Couldn't work out where the tokens go, so they stay put: ${errorMessage(err)}`, "WARNING");
  }
  const lightsChanged = plan.lights !== lights;
  try {
    if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: plan.lights });
    try {
      await OBR.scene.setMetadata({ [TRACKER_KEY]: moved });
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
    { store: "scene" as const, key: TRACKER_KEY, before: scene[TRACKER_KEY], after: moved },
  ]);
  // Tokens move before they are shown, so nobody sees them jump.
  const ids = Object.keys(move).filter((id) => move[id].x !== 0 || move[id].y !== 0);
  if (ids.length > 0) {
    await OBR.scene.items
      .updateItems(ids, (drafts) => {
        for (const d of drafts) d.position = { x: d.position.x + move[d.id].x, y: d.position.y + move[d.id].y };
      })
      .catch((err) => notify(`Couldn't move the tokens: ${errorMessage(err)}`, "WARNING"));
  }
  await afterChange(tracker, moved, settings);
  if (plan.stayed > 0) notify(`${plan.stayed} light${plan.stayed === 1 ? "" : "s"} stayed put: that token already burns one.`, "WARNING");
  return null;
};
