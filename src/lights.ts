// Light timers (docs/design.md, Torchlight merge). Pure functions only (no
// SDK, no React); the clock comes in as `now` (epoch ms, UTC) so every rule
// here is unit-tested. Ported from the web toolkit's Light Tracker
// (shadowdark-gm-toolkit lightStore.js, SPEC 10) onto Torchlight's end-time
// clock.
//
// Every light belongs to a token (`tokenId`): no light without one. A token
// holds at most one lit light (p. 84: lighting a new source puts out the
// old; Torchlight's rule too).
//
// Time model: a burning light stores `endsAt`, when it runs out, so every
// client counts down alike from the same document. `remainingMs` is the time
// it had when it last started burning (a cap: a clock set backwards never
// adds time). Out, spent or paused: `endsAt` is null and `remainingMs` is
// the frozen time left.
//
// Lights burn out on their own: `remaining` reads 0 at the end time, so a
// light stops shining on every client without a write. Every change first
// `settle`s, turning lit lights at 0 into spent ones.

import { intIn, isObject } from "./parse";

export const MINUTE = 60_000;

// Rule durations, real time (core rulebook pages).
export type LightKind = "torch" | "lantern" | "lightSpell" | "campfire";
export const LIGHT_KINDS: Record<LightKind, { label: string; minutes: number; range: string; page: number }> = {
  torch: { label: "Torch", minutes: 60, range: "near", page: 34 },
  lantern: { label: "Lantern", minutes: 60, range: "double near", page: 34 },
  lightSpell: { label: "Light spell", minutes: 60, range: "near", page: 64 },
  campfire: { label: "Campfire", minutes: 480, range: "near", page: 86 },
};
export const KIND_IDS = Object.keys(LIGHT_KINDS) as LightKind[];
const fullMs = (kind: LightKind) => LIGHT_KINDS[kind].minutes * MINUTE;

// Lighting a second light (p. 84): it joins the timer already burning, or
// keeps its own.
export type LightingRule = "rideAlong" | "separate";
// Putting a light back on: it continues its own time, or follows the
// lighting rule like a newly lit one.
export type RelightRule = "resume" | "lightingRule";

export const LOW_MS = 10 * MINUTE;
// Room metadata is 16 kB for every extension together (docs/design.md, room
// budget).
export const MAX_LIGHTS = 12;
export const MAX_CARRIER = 40;
export const MAX_NOTE = 80;
export const MAX_PASS_MS = 24 * 60 * MINUTE;

export type Status = "lit" | "out" | "spent";

export type Light = {
  id: string;
  kind: LightKind;
  // The token carrying it, and its name when lit (shown when the token isn't
  // on the open map; otherwise the token's own name is).
  tokenId: string;
  carrier: string;
  note: string;
  status: Status;
  remainingMs: number;
  // Burning: when it runs out (epoch ms). Null when out, spent or paused.
  endsAt: number | null;
  // A lantern's shutter: dark, but the oil keeps burning.
  shuttered: boolean;
  // When it burned out (epoch ms), for spent lights.
  spentAt: number | null;
};

export type Lights = {
  paused: boolean;
  lightingRule: LightingRule;
  relightRule: RelightRule;
  lights: Light[];
};

export const emptyLights = (): Lights => ({ paused: false, lightingRule: "rideAlong", relightRule: "resume", lights: [] });

// --- Reading -------------------------------------------------------------

export const remaining = (l: Light, now: number) =>
  l.status !== "lit" || l.endsAt === null ? l.remainingMs : Math.min(l.remainingMs, Math.max(0, l.endsAt - now));

export const shining = (l: Light, now: number) => l.status === "lit" && !l.shuttered && remaining(l, now) > 0;
export const low = (l: Light, now: number) => l.status === "lit" && remaining(l, now) <= LOW_MS;
// Lit but at 0, not settled yet: shows as burned out.
export const burnedOut = (l: Light, now: number) => l.status === "spent" || (l.status === "lit" && remaining(l, now) === 0);

// "none" when no lights are tracked (the GM isn't using them, so nothing is
// implied), "lit" while one shines, "dark" otherwise.
export const lightStatus = (s: Lights, now: number): "none" | "lit" | "dark" =>
  s.lights.length === 0 ? "none" : s.lights.some((l) => shining(l, now)) ? "lit" : "dark";

export const shiningCount = (s: Lights, now: number) => s.lights.filter((l) => shining(l, now)).length;

// The lit light a token already holds (other than `except`).
export const litOn = (s: Lights, tokenId: string, except?: string) =>
  s.lights.find((l) => l.tokenId === tokenId && l.status === "lit" && l.id !== except) ?? null;

// Milliseconds until the next lit light burns out; null when none burns (or
// paused).
export const msToNextBurnOut = (s: Lights, now: number) => {
  if (s.paused) return null;
  const left = s.lights.filter((l) => l.status === "lit").map((l) => remaining(l, now));
  return left.length ? Math.min(...left) : null;
};

// --- Changes -------------------------------------------------------------
// Each returns the same object when nothing changed (no write). Bad input
// throws: the UI only offers what's allowed.

// The token already carries a lit light; the UI asks first ("Put out the
// torch, light the lantern").
export class AlreadyLitError extends Error {
  constructor(readonly light: Light) {
    super(`${light.carrier || "That token"} already carries a lit ${LIGHT_KINDS[light.kind].label.toLowerCase()}`);
    this.name = "AlreadyLitError";
  }
}

const mapLight = (s: Lights, id: string, change: (l: Light) => Light): Lights => ({
  ...s,
  lights: s.lights.map((l) => (l.id === id ? change(l) : l)),
});

const find = (s: Lights, id: string) => {
  const light = s.lights.find((l) => l.id === id);
  if (!light) throw new Error(`Unknown light: ${id}`);
  return light;
};

const freeze = (l: Light, now: number): Light => ({ ...l, remainingMs: remaining(l, now), endsAt: null });
// Starts (or restarts) `l` burning with `ms` left; paused, it waits frozen.
const burn = (l: Light, ms: number, now: number, paused: boolean): Light => ({
  ...l,
  status: "lit",
  remainingMs: ms,
  endsAt: paused ? null : now + ms,
});

// Lit lights at 0 become spent, stamped with when they really ran out.
export const settle = (s: Lights, now: number): Lights => {
  let changed = false;
  const lights = s.lights.map((l) => {
    if (l.status !== "lit" || l.endsAt === null || remaining(l, now) > 0) return l;
    changed = true;
    return { ...l, status: "spent" as const, remainingMs: 0, endsAt: null, spentAt: Math.min(l.endsAt, now) };
  });
  return changed ? { ...s, lights } : s;
};

// Lights `id` against what else shines: under Ride along it joins the
// shortest timer burning; a campfire keeps its own 8 hours (built for a rest,
// not carried, p. 86).
const lightUnderRule = (s: Lights, id: string, now: number): Lights => {
  const others = s.lights.filter((l) => l.id !== id && shining(l, now)).map((l) => remaining(l, now));
  return mapLight(s, id, (l) => {
    const rides = s.lightingRule === "rideAlong" && others.length > 0 && l.kind !== "campfire";
    return burn(l, rides ? Math.min(l.remainingMs, ...others) : l.remainingMs, now, s.paused);
  });
};

const cleanText = (text: string, max: number) => text.trim().slice(0, max);

export const addLight = (
  state: Lights,
  now: number,
  newId: () => string,
  { kind, tokenId, carrier = "", note = "" }: { kind: LightKind; tokenId: string; carrier?: string; note?: string },
): Lights => {
  if (!KIND_IDS.includes(kind)) throw new TypeError(`Unknown light: ${kind}`);
  if (!tokenId) throw new TypeError("A light needs a token");
  const s = settle(state, now);
  const held = litOn(s, tokenId);
  if (held) throw new AlreadyLitError(held);
  if (s.lights.length >= MAX_LIGHTS) throw new RangeError(`Up to ${MAX_LIGHTS} lights; remove a spent one first`);
  const light: Light = {
    id: newId(),
    kind,
    tokenId,
    carrier: cleanText(carrier, MAX_CARRIER),
    note: cleanText(note, MAX_NOTE),
    status: "out",
    remainingMs: fullMs(kind),
    endsAt: null,
    shuttered: false,
    spentAt: null,
  };
  return lightUnderRule({ ...s, lights: [...s.lights, light] }, light.id, now);
};

// Puts out the token's lit light and lights `kind` instead, as one change
// (the answer to "Put out the torch, light the lantern").
export const swapLight = (
  state: Lights,
  now: number,
  newId: () => string,
  light: { kind: LightKind; tokenId: string; carrier?: string; note?: string },
): Lights => {
  const s = settle(state, now);
  const held = litOn(s, light.tokenId);
  return addLight(held ? putOut(s, now, held.id) : s, now, newId, light);
};

// Back on, keeping carrier and note. Put out: Resume continues its own time;
// "Treat as newly lit" follows the lighting rule. Spent: back with a full
// timer, then the same.
export const relight = (state: Lights, now: number, id: string): Lights => {
  const s = settle(state, now);
  const light = find(s, id);
  if (light.status === "lit") return s;
  const held = litOn(s, light.tokenId, id);
  if (held) throw new AlreadyLitError(held);
  const restored =
    light.status === "spent" ? mapLight(s, id, (l) => ({ ...l, status: "out", remainingMs: fullMs(l.kind), spentAt: null })) : s;
  if (s.relightRule === "lightingRule") return lightUnderRule(restored, id, now);
  return mapLight(restored, id, (l) => burn(l, l.remainingMs, now, s.paused));
};

export const putOut = (state: Lights, now: number, id: string): Lights => {
  const s = settle(state, now);
  if (find(s, id).status !== "lit") return s;
  return mapLight(s, id, (l) => ({ ...freeze(l, now), status: "out" }));
};

// Every lit light goes out, keeping its time.
export const putAllOut = (state: Lights, now: number): Lights => {
  const s = settle(state, now);
  if (!s.lights.some((l) => l.status === "lit")) return s;
  return { ...s, lights: s.lights.map((l) => (l.status === "lit" ? { ...freeze(l, now), status: "out" } : l)) };
};

// A manual fix: 1 s up to the light's full time. A spent light comes back
// out with that time, ready to relight; a lit one burns on from it.
export const setRemaining = (state: Lights, now: number, id: string, ms: number): Lights => {
  const s = settle(state, now);
  const light = find(s, id);
  const full = fullMs(light.kind);
  if (!Number.isInteger(ms) || ms < 1000 || ms > full) throw new RangeError(`Set between 0:01 and ${full / MINUTE} minutes`);
  return mapLight(s, id, (l) => (l.status === "lit" ? burn(l, ms, now, s.paused) : { ...l, status: "out", remainingMs: ms, spentAt: null }));
};

export const toggleShutter = (state: Lights, now: number, id: string): Lights => {
  const s = settle(state, now);
  if (find(s, id).kind !== "lantern") throw new Error("Only lanterns have a shutter");
  return mapLight(s, id, (l) => ({ ...l, shuttered: !l.shuttered }));
};

// A fresh flask (1 hour). A spent lantern comes back out, ready to light.
export const refillOil = (state: Lights, now: number, id: string): Lights => {
  const s = settle(state, now);
  if (find(s, id).kind !== "lantern") throw new Error("Only lanterns take oil");
  const full = fullMs("lantern");
  return mapLight(s, id, (l) =>
    l.status === "lit" ? burn(l, full, now, s.paused) : { ...l, status: "out", remainingMs: full, endsAt: null, spentAt: null },
  );
};

export const removeLight = (state: Lights, now: number, id: string): Lights => {
  const s = settle(state, now);
  find(s, id);
  return { ...s, lights: s.lights.filter((l) => l.id !== id) };
};

// Every light gone (the end of a session); the two rules and Pause stay.
export const removeAll = (s: Lights): Lights => (s.lights.length === 0 ? s : { ...s, lights: [] });

export const editNote = (state: Lights, now: number, id: string, note: string): Lights => {
  const s = settle(state, now);
  const text = cleanText(note, MAX_NOTE);
  return find(s, id).note === text ? s : mapLight(s, id, (l) => ({ ...l, note: text }));
};

// The token was renamed: its lights follow (the name shown off its map).
export const renameCarrier = (state: Lights, tokenId: string, name: string): Lights => {
  const text = cleanText(name, MAX_CARRIER);
  if (!state.lights.some((l) => l.tokenId === tokenId && l.carrier !== text)) return state;
  return { ...state, lights: state.lights.map((l) => (l.tokenId === tokenId ? { ...l, carrier: text } : l)) };
};

// Freezes every light (a break, a rules lookup).
export const pause = (state: Lights, now: number): Lights => {
  const s = settle(state, now);
  if (s.paused) return s;
  return { ...s, paused: true, lights: s.lights.map((l) => (l.status === "lit" ? freeze(l, now) : l)) };
};

export const resume = (state: Lights, now: number): Lights => {
  if (!state.paused) return settle(state, now);
  return { ...state, paused: false, lights: state.lights.map((l) => (l.status === "lit" ? burn(l, l.remainingMs, now, false) : l)) };
};

// "Time passes": `ms` off every lit light, shuttered lanterns included (the
// oil burns). Lights reaching 0 are spent; out ones are untouched. Works
// while paused.
export const timePasses = (state: Lights, now: number, ms: number): Lights => {
  if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_PASS_MS) throw new RangeError("Time passes takes up to 24 hours");
  const s = settle(state, now);
  if (!s.lights.some((l) => l.status === "lit")) return s;
  return {
    ...s,
    lights: s.lights.map((l) => {
      if (l.status !== "lit") return l;
      const left = remaining(l, now) - ms;
      if (left <= 0) return { ...l, status: "spent" as const, remainingMs: 0, endsAt: null, spentAt: now };
      return burn(l, left, now, s.paused);
    }),
  };
};

export const setLightingRule = (s: Lights, rule: LightingRule): Lights => (s.lightingRule === rule ? s : { ...s, lightingRule: rule });
export const setRelightRule = (s: Lights, rule: RelightRule): Lights => (s.relightRule === rule ? s : { ...s, relightRule: rule });

// --- Time entry ----------------------------------------------------------

// "Time passes": "10m", "10 min", "1h", "1.5h", "1h30m", "1h 30", "1:30"
// (h:mm), "90" (minutes). Milliseconds, or null for anything else, zero, or
// more than 24 hours.
export const parseTimeEntry = (raw: string): number | null => {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  let ms: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d{1,4})$/))) ms = Number(m[1]) * MINUTE;
  else if ((m = text.match(/^(\d{1,2}):([0-5]\d)$/))) ms = (Number(m[1]) * 60 + Number(m[2])) * MINUTE;
  else if ((m = text.match(/^(\d{1,4})(?:m|min|mins|minutes?)$/))) ms = Number(m[1]) * MINUTE;
  else if ((m = text.match(/^(\d{1,2}(?:\.\d{1,2})?)(?:h|hr|hrs|hours?)$/))) ms = Math.round(Number(m[1]) * 60) * MINUTE;
  else if ((m = text.match(/^(\d{1,2})(?:h|hr|hrs)(\d{1,3})(?:m|min|mins)?$/))) ms = (Number(m[1]) * 60 + Number(m[2])) * MINUTE;
  return ms !== null && ms > 0 && ms <= MAX_PASS_MS ? ms : null;
};

// Setting a light's time, read the way the countdown shows it: "42:15" is
// 42 min 15 s, "1:00:00" is h:mm:ss; colon-free forms as in Time passes.
export const parseClockEntry = (raw: string): number | null => {
  const text = raw.trim();
  let m: RegExpMatchArray | null;
  const positive = (ms: number) => (ms > 0 ? ms : null);
  if ((m = text.match(/^(\d{1,3}):([0-5]\d)$/))) return positive((Number(m[1]) * 60 + Number(m[2])) * 1000);
  if ((m = text.match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/))) return positive((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
  return text.includes(":") ? null : parseTimeEntry(text);
};

// "42:15", "8:00:00". Rounds up, so 0:00 means out.
export const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// --- Parsing -------------------------------------------------------------
// Room metadata is untrusted (any client, any extension): malformed lights
// drop, numbers clamp into range.

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export const parseLight = (raw: unknown): Light | null => {
  if (!isObject(raw)) return null;
  const { id, kind, tokenId, status } = raw;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
  if (typeof tokenId !== "string" || tokenId.length === 0 || tokenId.length > 64) return null;
  if (typeof kind !== "string" || !KIND_IDS.includes(kind as LightKind)) return null;
  if (status !== "lit" && status !== "out" && status !== "spent") return null;
  const k = kind as LightKind;
  const remainingMs = intIn(raw.remainingMs, 0, fullMs(k)) ?? (status === "spent" ? 0 : fullMs(k));
  const endsAt = status === "lit" ? time(raw.endsAt) : null;
  return {
    id,
    kind: k,
    tokenId,
    carrier: text(raw.carrier, MAX_CARRIER),
    note: text(raw.note, MAX_NOTE),
    status,
    remainingMs: status === "spent" ? 0 : remainingMs,
    endsAt,
    shuttered: k === "lantern" && raw.shuttered === true,
    spentAt: status === "spent" ? time(raw.spentAt) : null,
  };
};

export const parseLights = (raw: unknown): Lights => {
  const s = emptyLights();
  if (!isObject(raw)) return s;
  s.paused = raw.paused === true;
  if (raw.lightingRule === "separate") s.lightingRule = "separate";
  if (raw.relightRule === "lightingRule") s.relightRule = "lightingRule";
  if (Array.isArray(raw.lights)) {
    const seen = new Set<string>();
    for (const item of raw.lights) {
      const light = parseLight(item);
      if (!light || seen.has(light.id)) continue;
      // One lit light per token: a second one reads as out (with the time
      // it was lit with; no clock here to say what's left).
      const doubled = light.status === "lit" && s.lights.some((l) => l.tokenId === light.tokenId && l.status === "lit");
      seen.add(light.id);
      s.lights.push(doubled ? { ...light, status: "out", endsAt: null } : light);
      if (s.lights.length >= MAX_LIGHTS) break;
    }
  }
  return s;
};
