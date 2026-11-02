// Players lighting their own (docs/design.md, Torchlight merge, PR 4b). The
// lights stay one GM doc: a player's click is a request, broadcast to the
// GM's client, whose background page checks it and writes it (Matt chose
// this over Torchlight's per-player docs, 2026-11-01). So the GM's setting
// is enforced where the write happens, not in the player's panel, and every
// reader keeps reading one doc. Players can light only while a GM is in the
// room; the map light needs the GM's client anyway (tokenLights.ts).
//
// Which tokens (Matt, 2026-11-01: party tokens): a visible character or
// mount image that's a player row on this map's initiative list (not a
// monster or the GM row), or one the player placed; the player picks it
// from the right-click menu (background.ts, menu.ts) or their panel. A
// campfire stays the GM's. Owlbear says who sent each message (its
// connectionId), so the light records who lit it (`by`) and shows in their
// panel. Requests aren't undo steps.
import OBR, { type Item, type Player } from "@owlbear-rodeo/sdk";

import { ID, LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { LIGHT_KINDS, litOn, newLightId, parseLights, putOut, settle, swapLight, type LightKind, type Lights } from "./lights";
import { isObject } from "./parse";
import { parseSettings } from "./settings";
import { GM_ENTRY, parseTracker, type Tracker } from "./tracker";
import { errorMessage } from "./utils";

export const REQUEST_CHANNEL = `${ID}/light-request`;
export const REPLY_CHANNEL = `${ID}/light-reply`;
// No answer by then: no GM's Crawl Keeper is listening.
export const REPLY_TIMEOUT_MS = 6000;

// What a player may carry (a campfire is the GM's: a stationary light).
export const PLAYER_KINDS: LightKind[] = ["torch", "lantern", "lightSpell"];

export type LightRequest = { id: string; tokenId: string; action: "light"; kind: LightKind } | { id: string; tokenId: string; action: "putOut" };
export type LightReply = { id: string; error: string | null };
// A request before it's given its id.
export type LightAsk = { tokenId: string; action: "light"; kind: LightKind } | { tokenId: string; action: "putOut" };

const shortId = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null);

// Broadcasts are untrusted: anything malformed is dropped.
export const parseRequest = (raw: unknown): LightRequest | null => {
  if (!isObject(raw)) return null;
  const id = shortId(raw.id);
  const tokenId = shortId(raw.tokenId);
  if (!id || !tokenId) return null;
  if (raw.action === "putOut") return { id, tokenId, action: "putOut" };
  if (raw.action === "light" && PLAYER_KINDS.includes(raw.kind as LightKind)) return { id, tokenId, action: "light", kind: raw.kind as LightKind };
  return null;
};

export const parseReply = (raw: unknown): LightReply | null => {
  if (!isObject(raw)) return null;
  const id = shortId(raw.id);
  if (!id) return null;
  return { id, error: typeof raw.error === "string" ? raw.error.slice(0, 200) : null };
};

// A token a player can light: a visible image on the character or mount
// layer (a hidden one they can't see, so a request for it is forged).
export const lightable = (item: Item | undefined): item is Item =>
  !!item && item.type === "IMAGE" && (item.layer === "CHARACTER" || item.layer === "MOUNT") && item.visible !== false;

export const PARTY_ONLY = "Party tokens only: a player on the initiative list, or a token you placed.";

// A party token: a player row on the list, or one this player placed.
export const partyToken = (item: Item | undefined, t: Tracker, playerId: string): item is Item =>
  lightable(item) && (item.createdUserId === playerId || t.entries.some((e) => e.id === item.id && e.id !== GM_ENTRY && !e.monster));

// The tokens in a player's panel: ones they placed, and ones holding a
// light they lit.
export const theirTokens = (items: Item[], s: Lights, playerId: string) => {
  const lit = new Set(s.lights.filter((l) => l.by === playerId).map((l) => l.tokenId));
  return items.filter((i) => lightable(i) && (i.createdUserId === playerId || lit.has(i.id)));
};

export const NOT_ALLOWED = "Your GM hasn't allowed players to light their own.";

// The GM's side, pure: the new doc, or why not. Lighting with another light
// lit swaps them (the player's panel asked first); asking for what's already
// so changes nothing.
export const answerRequest = (
  s: Lights,
  now: number,
  newId: () => string,
  req: LightRequest,
  ctx: { allowed: boolean; token: Item | undefined; playerId: string | null; tracker: Tracker },
): { lights: Lights } | { error: string } => {
  if (!ctx.allowed) return { error: NOT_ALLOWED };
  const by = ctx.playerId;
  if (!by) return { error: "The GM's Crawl Keeper couldn't tell who asked. Try again." };
  if (!partyToken(ctx.token, ctx.tracker, by)) return { error: PARTY_ONLY };
  const settled = settle(s, now);
  try {
    if (req.action === "putOut") {
      const held = litOn(settled, req.tokenId);
      return { lights: held ? putOut(settled, now, held.id) : s };
    }
    if (litOn(settled, req.tokenId)?.kind === req.kind) return { lights: s };
    const after = swapLight(settled, now, newId, { kind: req.kind, tokenId: req.tokenId, carrier: ctx.token.name });
    // Theirs now (a lantern lit again too), for their panel.
    return { lights: { ...after, lights: after.lights.map((l) => (l.tokenId === req.tokenId && l.status === "lit" ? { ...l, by } : l)) } };
  } catch (err) {
    return { error: errorMessage(err) };
  }
};

// With two GM clients (two tabs, a co-GM) only one answers: the lowest
// connection id among them. If they disagree for a moment both answer, which
// is safe: each reads fresh, and the same request twice changes nothing.
export const leadsGms = (me: string, players: Player[]) => players.every((p) => p.role !== "GM" || p.connectionId >= me);

// --- The GM's background page --------------------------------------------

export const watchLightRequests = () => {
  let queue: Promise<unknown> = Promise.resolve();
  const answer = async (raw: unknown, from: string) => {
    const req = parseRequest(raw);
    if (!req) return;
    const [role, me, players] = await Promise.all([OBR.player.getRole(), OBR.player.getConnectionId(), OBR.party.getPlayers()]);
    if (role !== "GM" || !leadsGms(me, players)) return;
    const sender = players.find((p) => p.connectionId === from);
    let error: string | null;
    try {
      const [room, scene, [token]] = await Promise.all([OBR.room.getMetadata(), OBR.scene.getMetadata(), OBR.scene.items.getItems([req.tokenId])]);
      const before = parseLights(room[LIGHTS_KEY]);
      const result = answerRequest(before, Date.now(), newLightId, req, {
        allowed: parseSettings(room[SETTINGS_KEY]).playersLight,
        token,
        playerId: sender?.id ?? null,
        tracker: parseTracker(scene[TRACKER_KEY]),
      });
      if ("error" in result) error = result.error;
      else {
        if (result.lights !== before) await OBR.room.setMetadata({ [LIGHTS_KEY]: result.lights });
        error = null;
      }
    } catch (err) {
      error = `The GM's Crawl Keeper couldn't do that: ${errorMessage(err)}`;
    }
    await OBR.broadcast.sendMessage(REPLY_CHANNEL, { id: req.id, error } satisfies LightReply, { destination: "REMOTE" });
  };
  return OBR.broadcast.onMessage(REQUEST_CHANNEL, ({ data, connectionId }) => {
    // One at a time, each reading the room fresh.
    const run = () => answer(data, connectionId).catch((err) => console.error(`Couldn't answer a player's light: ${errorMessage(err)}`));
    queue = queue.then(run, run);
  });
};

// --- The player's panel --------------------------------------------------

// Sends one request and waits for the GM's answer: null when done, else
// what to tell the player.
export const requestLight = (req: LightAsk): Promise<string | null> => {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const done = (error: string | null) => {
      clearTimeout(timer);
      off();
      resolve(error);
    };
    const off = OBR.broadcast.onMessage(REPLY_CHANNEL, ({ data }) => {
      const reply = parseReply(data);
      if (reply?.id === id) done(reply.error);
    });
    const timer = setTimeout(() => done("No answer from the GM's Crawl Keeper. Is the GM in the room?"), REPLY_TIMEOUT_MS);
    OBR.broadcast.sendMessage(REQUEST_CHANNEL, { ...req, id }, { destination: "REMOTE" }).catch((err) => done(`Couldn't reach the GM: ${errorMessage(err)}`));
  });
};

export const verbFor = (kind: LightKind) => (kind === "lightSpell" ? "Cast Light" : `Light ${LIGHT_KINDS[kind].label.toLowerCase()}`);
