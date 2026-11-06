// Effect notices for everyone (docs/effects.md "Notices"): "Bless on Borin
// ended." when a rounds effect runs out as the turn moves on. Like the light
// notices, each client's background page works it out itself from the
// scene's tracker and effects (an ending writes nothing), so nothing is
// broadcast and two GM clients don't say it twice. ◀ then ▶ again doesn't
// repeat it while the room stays loaded.
import OBR, { type Item, type Metadata } from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, TRACKER_KEY } from "./constants";
import { parseEffects, statusOf, type Effect, type Effects } from "./effects";
import { parseTracker, type Tracker } from "./tracker";
import { logEvent } from "./sessionLog";
import { errorMessage } from "./utils";

export type Reading = { tracker: Tracker; effects: Effects };

// One ending: the effect and where it ended, so a new end (rounds left
// edited) can be told again.
const endKey = (e: Effect) => `${e.id}@${e.end?.round}:${e.end?.at}`;

// Pure: the effects that ran out between two readings (active before, ended
// now) and haven't been told yet. Removed effects, Time passes and focus
// ending say nothing here: those are the GM's own actions.
export const newlyEnded = (before: Reading, after: Reading, told: ReadonlySet<string>): Effect[] =>
  after.effects.effects.filter((e) => {
    if (statusOf(e, after.tracker).state !== "ended" || told.has(endKey(e))) return false;
    const was = before.effects.effects.find((b) => b.id === e.id);
    return !!was && statusOf(was, before.tracker).state === "active";
  });

// What a client says, or "" for nothing. Players don't hear of hidden
// effects or of effects on tokens hidden from them (or gone); the GM hears
// everything.
export const endedMessage = (ended: Effect[], items: Pick<Item, "id" | "name" | "visible">[], gm: boolean) =>
  ended
    .flatMap((e) => {
      const holder = e.holder === null ? null : items.find((i) => i.id === e.holder);
      if (!gm && (e.hidden || (e.holder !== null && (!holder || !holder.visible)))) return [];
      const on = holder?.name.trim() ? ` on ${holder.name.trim()}` : "";
      return [`${e.name}${on} ended.`];
    })
    .join(" ");

export const watchEffectNotices = () => {
  let gm = false;
  const role = (r: string) => (gm = r === "GM");
  OBR.player
    .getRole()
    .then(role)
    .catch((err) => console.warn(`Couldn't read the role: ${errorMessage(err)}`));
  const offPlayer = OBR.player.onChange((p) => role(p.role));

  // This scene's last reading; null until known (a scene opening, or the
  // page loading, has nothing to compare with).
  let held: Reading | null = null;
  let lastRaw: string | undefined;
  const told = new Set<string>();
  const say = async (ended: Effect[]) => {
    const holders = [...new Set(ended.flatMap((e) => (e.holder === null ? [] : [e.holder])))];
    const items = holders.length ? await OBR.scene.items.getItems(holders) : [];
    const text = endedMessage(ended, items, gm);
    if (!text) return;
    logEvent(text, "effect");
    await OBR.notification.show(text, "INFO");
  };
  const see = (m: Metadata) => {
    const raw = JSON.stringify([m[TRACKER_KEY], m[EFFECTS_KEY]]);
    if (raw === lastRaw) return;
    lastRaw = raw;
    const reading = { tracker: parseTracker(m[TRACKER_KEY]), effects: parseEffects(m[EFFECTS_KEY]) };
    const ended = held ? newlyEnded(held, reading, told) : [];
    held = reading;
    if (!ended.length) return;
    for (const e of ended) told.add(endKey(e));
    say(ended).catch((err) => console.warn(`Couldn't tell an effect ended: ${errorMessage(err)}`));
  };
  const seed = () =>
    OBR.scene
      .getMetadata()
      .then((m) => held === null && see(m))
      .catch((err) => console.warn(`Couldn't read the scene for effect notices: ${errorMessage(err)}`));
  OBR.scene
    .isReady()
    .then((ready) => {
      if (ready) return seed();
    })
    .catch((err) => console.warn(`Couldn't check for a scene: ${errorMessage(err)}`));
  const offReady = OBR.scene.onReadyChange((ready) => {
    held = null;
    lastRaw = undefined;
    if (ready) void seed();
  });
  // An update that lands before the seed is the first reading.
  const offMetadata = OBR.scene.onMetadataChange(see);
  return () => {
    offPlayer();
    offReady();
    offMetadata();
  };
};
