// The GM's Party / Split switch (the panel's button, and Combat): reads the
// room and the map fresh, plans the turns and lights (partySwitch.ts), works
// out where the players stand (placement.ts), moves them and attaches or
// detaches and shows or hides them in one map update (marker.ts syncParty,
// which undo runs too; undo doesn't move tokens back), then saves the lights
// and the tracker as one undo step. The map goes first (Dynamic Fog, see
// syncParty); the lights before the tracker so the map is never left dark;
// if a save fails, the lights and the map go back.
//
// Together: the Party token is the rally point (the GM drags it, hidden, to
// where the party gathers); the players are pulled to free spots around it
// clear of Dynamic Fog's walls, then attached to it (position only) and
// hidden, so they travel with it. Split: they're detached and shown where they
// stand; any the trip left behind or in a wall move to a legal spot.
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { parseLights } from "./lights";
import { afterChange, readSettings, syncParty } from "./marker";
import { carriers, planSwitch } from "./partySwitch";
import { around, gather, strays, type Placed, type Wall } from "./placement";
import { MAX_ENTRIES, parseTracker, setParty, setPrior, toCombat, type Point, type PriorAttach } from "./tracker";
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
  if (tracker.party === null) {
    notify("No party token on this map: right-click a token → Crawl Keeper → Set as party token.", "WARNING");
    return null;
  }
  const monsters = tracker.entries.filter((e) => e.monster).map((e) => e.id);
  const items = await OBR.scene.items.getItems([tracker.party, ...carriers(tracker), ...monsters]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const nameOf = (id: string) => byId.get(id)?.name?.trim() || "Unnamed";
  const plan = planSwitch(tracker, lights, Date.now(), together, nameOf, pick);
  if (!plan.done) return plan.choices.map((id) => ({ id, name: nameOf(id) }));
  let next = combat ? toCombat(plan.tracker, combat.clearRolls) : plan.tracker;
  if (next === tracker && plan.lights === lights) {
    notify(together ? "The party is already together." : "The party is already split.", "INFO");
    return null;
  }

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

  // Tokens first, lights after: Dynamic Fog draws a token's light hidden if
  // the light is set while the token is hidden and misses the token being
  // shown a moment later (Matt's room, 2026-11-07: a shown party token whose
  // drawn light stayed hidden; hiding and showing it again fixed it).
  // The players' moves go in the same update (marker.ts syncParty).
  const was = Object.fromEntries(players.filter((p) => spots[p.id]).map((p) => [p.id, p.center]));
  await syncParty(tracker, next, spots).catch((err) => notify(`Couldn't move the party's tokens together or apart: ${errorMessage(err)}`, "WARNING"));
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
    await syncParty(next, tracker, was).catch(() => undefined);
    notify(`Couldn't ${together ? "bring the party together" : "split the party"}: ${errorMessage(err)}`, "WARNING");
    return null;
  }
  await record(combat ? "Combat" : together ? "Party together" : "Split the party", [
    ...(lightsChanged ? [{ store: "room" as const, key: LIGHTS_KEY, before: lights, after: plan.lights }] : []),
    { store: "scene" as const, key: TRACKER_KEY, before: scene[TRACKER_KEY], after: next },
  ]);
  // The turn ring (the party's tokens again: already in place).
  await afterChange(tracker, next, settings, true);
  if (plan.stayed > 0) notify(`${plan.stayed} light${plan.stayed === 1 ? "" : "s"} stayed put: that token already burns one.`, "WARNING");
  return null;
};

// Set, replace or clear the Party token (map right-click and row menu): one
// undo step. If the party is together, it splits first the way Split does:
// the Party token's light goes back to the remembered carrier (none
// remembered: it stays put, and the GM is told), and the players are let go
// and shown (marker.ts syncParty). `id` null, or the Party token again: clear.
export const changePartyToken = async (id: string | null) => {
  const [scene, room, settings] = await Promise.all([OBR.scene.getMetadata(), OBR.room.getMetadata(), readSettings()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const lights = parseLights(room[LIGHTS_KEY]);
  const target = id === tracker.party ? null : id;
  let base = tracker;
  let newLights = lights;
  let stayed = 0;
  if (tracker.party !== null && tracker.together) {
    const items = await OBR.scene.items.getItems([tracker.party, ...carriers(tracker)]);
    const nameOf = (x: string) => items.find((i) => i.id === x)?.name?.trim() || "Unnamed";
    const plan = planSwitch(tracker, lights, Date.now(), false, nameOf, tracker.carrier ?? undefined);
    if (plan.done) {
      base = plan.tracker;
      newLights = plan.lights;
      stayed = plan.stayed;
    } else {
      notify("The party token keeps its light: no one has carried it yet. Hand it on with right-click → Hand light to….", "WARNING");
    }
  }
  const next = setParty(base, target);
  if (target !== null && next.party !== target)
    return notify(
      tracker.entries.some((e) => e.id === target && e.monster) ? "A monster can't be the party token: mark it as a player first." : `Initiative is full (${MAX_ENTRIES} rows): the party token wasn't set.`,
      "WARNING",
    );
  if (next === tracker && newLights === lights) return;
  // Tokens first, lights after (see switchParty).
  await syncParty(tracker, next).catch((err) => notify(`Couldn't let the party's tokens go: ${errorMessage(err)}`, "WARNING"));
  const lightsChanged = newLights !== lights;
  try {
    if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: newLights });
    try {
      await OBR.scene.setMetadata({ [TRACKER_KEY]: next });
    } catch (err) {
      if (lightsChanged) await OBR.room.setMetadata({ [LIGHTS_KEY]: lights }).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    await syncParty(next, tracker).catch(() => undefined);
    return notify(`Couldn't ${target === null ? "clear" : "set"} the party token: ${errorMessage(err)}`, "WARNING");
  }
  await record(target === null ? "Clear party token" : "Set party token", [
    ...(lightsChanged ? [{ store: "room" as const, key: LIGHTS_KEY, before: lights, after: newLights }] : []),
    { store: "scene" as const, key: TRACKER_KEY, before: scene[TRACKER_KEY], after: next },
  ]);
  await afterChange(tracker, next, settings, true);
  if (stayed > 0) notify(`${stayed} light${stayed === 1 ? "" : "s"} stayed put: that token already burns one.`, "WARNING");
};
