// The map's right-click Add effect… (docs/effects.md "Adding and removing"):
// the menu can't show the form itself, so it leaves the tokens for the panel
// and opens it. Two ways, since the panel may be closed (it reads the
// handoff when the tracker mounts) or open (the broadcast tells it now).
// sessionStorage is this tab's, shared by every Crawl Keeper page in it
// (src/storage.ts), so it never reaches another client; the broadcast is
// LOCAL for the same reason.
import OBR from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { readSession, writeSession } from "./storage";

export const ADD_EFFECT_CHANNEL = `${ID}/add-effect`;
const KEY = `${ID}/add-effect`;
// A handoff older than this is stale (the panel never opened): ignored.
export const HANDOFF_MS = 30_000;
const MAX_IDS = 40;

// Untrusted (storage and broadcasts): a list of item ids, or null.
export const parseIds = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IDS) return null;
  const ids = raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64);
  return ids.length === raw.length ? [...new Set(ids)] : null;
};

// The menu's side: leave the tokens, tell an open panel, open it.
export const askToAddEffect = async (ids: string[], now = Date.now()) => {
  writeSession(KEY, JSON.stringify({ ids, at: now }));
  await OBR.broadcast.sendMessage(ADD_EFFECT_CHANNEL, { ids }, { destination: "LOCAL" });
  await OBR.action.open();
};

// The panel's side: the waiting tokens, if fresh, taken once.
export const takeHandoff = (now = Date.now()): string[] | null => {
  const raw = readSession(KEY);
  if (raw === null) return null;
  writeSession(KEY, "");
  try {
    const { ids, at } = JSON.parse(raw) as { ids?: unknown; at?: unknown };
    return typeof at === "number" && now - at >= 0 && now - at <= HANDOFF_MS ? parseIds(ids) : null;
  } catch {
    return null;
  }
};

// Every message on the channel (the payload, parsed). The panel switches to
// the list; the tracker takes the handoff (or the payload, if storage is
// blocked).
export const onAddEffect = (fn: (ids: string[]) => void) =>
  OBR.broadcast.onMessage(ADD_EFFECT_CHANNEL, ({ data }) => {
    const ids = parseIds((data as { ids?: unknown } | null)?.ids);
    if (ids) fn(ids);
  });
