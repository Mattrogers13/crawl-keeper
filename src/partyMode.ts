// The GM's Party / Split switch (the panel's button, and Combat): reads the
// room and the map fresh, plans the turns and lights (partySwitch.ts), works
// out where the players stand (placement.ts), saves the lights then the
// tracker as one undo step, moves the players, then attaches or detaches and
// shows or hides them (marker.ts syncParty via afterChange, which undo runs
// too; undo doesn't move tokens back). The lights go first so the map is
// never left dark; if the tracker then fails to save, the lights go back.
//
// Together: the Party token is the rally point (the GM drags it, hidden, to
// where the party gathers); the players are pulled to free spots around it
// clear of Dynamic Fog's walls, then attached to it (position only) and
// hidden, so they travel with it. Split: they're detached and shown where they
// stand; any the trip left behind or in a wall move to a legal spot.
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { parseLights } from "./lights";
import { afterChange, readSettings } from "./marker";
import { carriers, planSwitch } from "./partySwitch";
import { around, gather, strays, type Placed, type Wall } from "./placement";
import { parseTracker, setPrior, toCombat, type Point, type PriorAttach } from "./tracker";
import { record } from "./undo";
import { errorMessage, notify } from "./utils";

export type Choice = { id: string; name: string };

// Dynamic Fog's walls: it builds them as local items in each client from the
// fog tool's shapes (room check, 2026-11-07: 80 local WALLs). Points in map
// px, offset by the item's position (0 in every case seen). None: no walls.
const readWalls = async (): Promise<Wall[]> => {
  const local = await OBR.scene.local.getItems().catch(() => [] as Item[]);
  return local
    .filter((i) => i.type === "WALL" && (i as Item & { blocking?: boolean }).blocking !== false)
    .map((i) => ((i as Item & { points?: Point[] }).points ?? []).map((p) => ({ x: p.x + i.position.x, y: p.y + i.position.y })))
    .filter((w) => w.length > 1);
};

// Snapped to the grid's cell centres (square or hex: Owlbear's own snap).
const snapAll = (spots: Point[]) =>
  Promise.all(spots.map((p) => OBR.scene.grid.snapPosition(p, 1, false, true).catch(() => p))).then((all) => {
    const seen = new Set<string>();
    return all.filter((p) => {
      const k = `${Math.round(p.x)},${Math.round(p.y)}`;
      return seen.has(k) ? false : (seen.add(k), true);
    });
  });

// `pick`: the carrier chosen for a split. `combat`: this split is the Combat
// button's (the phase changes in the same step; clearRolls per Settings).
// Returns who to ask when a light needs a carrier, else null (done, or a
// failure was told).
export const switchParty = async (together: boolean, pick?: string, combat?: { clearRolls: boolean }): Promise<Choice[] | null> => {
  const [scene, room, settings] = await Promise.all([OBR.scene.getMetadata(), OBR.room.getMetadata(), readSettings()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const lights = parseLights(room[LIGHTS_KEY]);
  if (tracker.party === null) return null;
  const monsters = tracker.entries.filter((e) => e.monster).map((e) => e.id);
  const items = await OBR.scene.items.getItems([tracker.party, ...carriers(tracker), ...monsters]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const nameOf = (id: string) => byId.get(id)?.name?.trim() || "Unnamed";
  const plan = planSwitch(tracker, lights, Date.now(), together, nameOf, pick);
  if (!plan.done) return plan.choices.map((id) => ({ id, name: nameOf(id) }));
  let next = combat ? toCombat(plan.tracker, combat.clearRolls) : plan.tracker;
  if (next === tracker && plan.lights === lights) return null;

  // A token's position is its centre (Owlbear anchors an image at its grid
  // offset, the middle by default; the turn ring relies on it too).
  const here = (ids: string[]): Placed[] => ids.flatMap((id) => (byId.has(id) ? [{ id, center: { ...byId.get(id)!.position } }] : []));
  const party = here([tracker.party])[0];
  const players = here(carriers(tracker));
  let spots: Record<string, Point> = {};
  if (party && players.length > 0 && tracker.together !== together) {
    try {
      const [walls, cell] = await Promise.all([readWalls(), OBR.scene.grid.getDpi().catch(() => 150)]);
      const taken = here(monsters).map((m) => m.center);
      if (together) {
        spots = gather(party.center, players, await snapAll(around(party.center, cell)), walls, cell, taken);
      } else {
        const lost = strays(party.center, players, walls, cell);
        const staying = players.filter((p) => !lost.includes(p)).map((p) => p.center);
        if (lost.length > 0) spots = gather(party.center, lost, await snapAll(around(party.center, cell)), walls, cell, [...taken, ...staying]);
      }
    } catch (err) {
      notify(`Couldn't work out where the players stand, so they stay put: ${errorMessage(err)}`, "WARNING");
    }
  }
  // Coming together, each player's own attachment is kept to put back on Split.
  if (together) {
    const prior: Record<string, PriorAttach> = {};
    for (const p of players) {
      const i = byId.get(p.id)!;
      prior[p.id] = { to: i.attachedTo && i.attachedTo !== tracker.party ? i.attachedTo : null, off: i.disableAttachmentBehavior ? [...i.disableAttachmentBehavior] : null };
    }
    next = setPrior(next, prior);
  }

  const lightsChanged = plan.lights !== lights;
  try {
    if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: plan.lights });
    try {
      await OBR.scene.setMetadata({ [TRACKER_KEY]: next });
    } catch (err) {
      if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: lights }).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    notify(`Couldn't ${together ? "bring the party together" : "split the party"}: ${errorMessage(err)}`, "WARNING");
    return null;
  }
  await record(combat ? "Combat" : together ? "Party together" : "Split the party", [
    ...(lightsChanged ? [{ store: "room" as const, key: LIGHTS_KEY, before: lights, after: plan.lights }] : []),
    { store: "scene" as const, key: TRACKER_KEY, before: scene[TRACKER_KEY], after: next },
  ]);
  // Players move first, then attach / detach and show / hide (afterChange).
  const ids = Object.keys(spots);
  if (ids.length > 0) {
    await OBR.scene.items
      .updateItems(ids, (drafts) => {
        for (const d of drafts) d.position = { ...spots[d.id] };
      })
      .catch((err) => notify(`Couldn't move the players: ${errorMessage(err)}`, "WARNING"));
  }
  await afterChange(tracker, next, settings);
  if (plan.stayed > 0) notify(`${plan.stayed} light${plan.stayed === 1 ? "" : "s"} stayed put: that token already burns one.`, "WARNING");
  return null;
};
