// Light notices for everyone (Torchlight's alerts, docs/design.md): a light
// burning out or put out, and time passing. Each client's background page
// works the light ones out itself from the lights doc and its own clock (a
// burn-out writes nothing), so nothing is broadcast and nothing is said
// twice. Time passes is the GM's action, sent once to everyone.
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { ID, LIGHTS_KEY } from "./constants";
import { LIGHT_KINDS, MAX_PASS_MS, MINUTE, msToNextBurnOut, parseLights, shining, type Light, type Lights } from "./lights";
import { errorMessage } from "./utils";

export const TIME_PASSES_CHANNEL = `${ID}/time-passes`;

const named = (l: Light) => `${LIGHT_KINDS[l.kind].label}${l.carrier ? ` (${l.carrier})` : ""}`;

// Pure: the lights that stopped shining between two readings, split into
// burned out (ran to their end) and put out (anything else: an action, or
// time passing). Removed lights say nothing.
export const wentOut = (before: Lights, beforeAt: number, after: Lights, now: number) => {
  const burned: Light[] = [];
  const out: Light[] = [];
  for (const was of before.lights) {
    if (!shining(was, beforeAt)) continue;
    const is = after.lights.find((l) => l.id === was.id);
    if (!is || shining(is, now)) continue;
    // Ran to its end time: still lit at 0, or spent when it was due to end.
    const ranOut =
      (is.status === "lit" && is.endsAt !== null && is.endsAt <= now) ||
      (is.status === "spent" && was.endsAt !== null && is.spentAt === was.endsAt);
    (ranOut ? burned : out).push(is);
  }
  return { burned, out };
};

export const outMessage = ({ burned, out }: { burned: Light[]; out: Light[] }) =>
  [
    burned.length ? `${burned.map(named).join(", ")} burned out.` : "",
    out.length ? `${out.map(named).join(", ")} went out.` : "",
  ]
    .filter(Boolean)
    .join(" ");

// "10 minutes", "1 hour 30 minutes".
export const formatSpan = (ms: number) => {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? "" : "s"}` : "");
  return [part(h, "hour"), part(m, "minute")].filter(Boolean).join(" ") || "under a minute";
};

// The GM's Time passes, once saved: everyone hears it.
export const sayTimePassed = (ms: number) =>
  OBR.broadcast.sendMessage(TIME_PASSES_CHANNEL, { ms }, { destination: "ALL" }).catch((err) => console.warn(`Couldn't send Time passes: ${errorMessage(err)}`));

export const watchLightNotices = () => {
  let held: { lights: Lights; at: number } | null = null;
  let lastRaw: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string) => OBR.notification.show(text, "WARNING").catch(() => {});
  const take = (lights: Lights) => {
    const now = Date.now();
    // The first reading (the room loading) has nothing to compare with.
    if (held) {
      const text = outMessage(wentOut(held.lights, held.at, lights, now));
      if (text) void say(text);
    }
    held = { lights, at: now };
    clearTimeout(timer);
    const next = msToNextBurnOut(lights, now);
    if (next !== null) timer = setTimeout(() => held && take(held.lights), next + 50);
  };
  const onRoom = (m: Metadata) => {
    const raw = JSON.stringify(m[LIGHTS_KEY]);
    if (raw === lastRaw) return;
    lastRaw = raw;
    take(parseLights(m[LIGHTS_KEY]));
  };
  OBR.room
    .getMetadata()
    .then((m) => held === null && onRoom(m))
    .catch((err) => console.warn(`Couldn't read the lights: ${errorMessage(err)}`));
  const offRoom = OBR.room.onMetadataChange(onRoom);
  const offTime = OBR.broadcast.onMessage(TIME_PASSES_CHANNEL, (e) => {
    const ms = (e.data as { ms?: unknown } | null)?.ms;
    if (typeof ms === "number" && Number.isInteger(ms) && ms > 0 && ms <= MAX_PASS_MS) void say(`Time passes: ${formatSpan(ms)}.`);
  });
  return () => {
    clearTimeout(timer);
    offRoom();
    offTime();
  };
};
