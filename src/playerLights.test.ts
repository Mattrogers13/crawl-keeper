import { describe, it, expect, vi } from "vitest";
import OBR, { type Player } from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, SETTINGS_KEY } from "./constants";
import { MAX_LIGHTS, MINUTE, parseLights } from "./lights";
import {
  NOT_ALLOWED,
  REPLY_CHANNEL,
  REPLY_TIMEOUT_MS,
  REQUEST_CHANNEL,
  answerRequest,
  leadsGms,
  parseRequest,
  requestLight,
  watchLightRequests,
} from "./playerLights";
import { obr, receiveBroadcast, token } from "./test/obrMock";

const NOW = 1_000_000;
let n = 0;
const newId = () => `new-${++n}`;
const greg = token("g", { name: "Greg", createdUserId: "greg" });
const ok = { allowed: true, token: greg, playerId: "greg" };
const lit = (tokenId: string, kind = "torch") => ({ id: `l-${tokenId}`, kind, tokenId, status: "lit", remainingMs: 60 * MINUTE, endsAt: NOW + 60 * MINUTE });
const none = parseLights({});
const lightsOf = (r: ReturnType<typeof answerRequest>) => {
  if ("error" in r) throw new Error(r.error);
  return r.lights;
};

describe("parseRequest (untrusted broadcasts)", () => {
  it("a player's light or put out; a campfire, junk or long ids are dropped", () => {
    expect(parseRequest({ id: "r", tokenId: "g", action: "light", kind: "lantern" })).toEqual({ id: "r", tokenId: "g", action: "light", kind: "lantern" });
    expect(parseRequest({ id: "r", tokenId: "g", action: "putOut", kind: "x" })).toEqual({ id: "r", tokenId: "g", action: "putOut" });
    expect(parseRequest({ id: "r", tokenId: "g", action: "light", kind: "campfire" })).toBeNull();
    expect(parseRequest({ id: "r", tokenId: "x".repeat(65), action: "putOut" })).toBeNull();
    expect(parseRequest("light")).toBeNull();
  });
});

describe("answerRequest (the GM's client decides)", () => {
  it("lights a torch on the player's own token, named for it", () => {
    const after = lightsOf(answerRequest(none, NOW, newId, { id: "r", tokenId: "g", action: "light", kind: "torch" }, ok));
    expect(after.lights).toMatchObject([{ kind: "torch", tokenId: "g", carrier: "Greg", status: "lit" }]);
  });

  it("refused when the GM hasn't allowed it, or the token isn't theirs (or is a prop, or unknown)", () => {
    const req = { id: "r", tokenId: "g", action: "light", kind: "torch" } as const;
    expect(answerRequest(none, NOW, newId, req, { ...ok, allowed: false })).toEqual({ error: NOT_ALLOWED });
    expect(answerRequest(none, NOW, newId, req, { ...ok, playerId: "steve" })).toHaveProperty("error");
    expect(answerRequest(none, NOW, newId, req, { ...ok, token: { ...greg, layer: "PROP" } })).toHaveProperty("error");
    expect(answerRequest(none, NOW, newId, req, { ...ok, token: undefined })).toHaveProperty("error");
    expect(answerRequest(none, NOW, newId, req, { ...ok, playerId: null })).toHaveProperty("error");
  });

  it("another light swaps; the same one again, or putting out nothing, changes nothing", () => {
    const s = parseLights({ lights: [lit("g")] });
    const swapped = lightsOf(answerRequest(s, NOW, newId, { id: "r", tokenId: "g", action: "light", kind: "lantern" }, ok));
    expect(swapped.lights.map((l) => [l.kind, l.status])).toEqual([["lantern", "lit"]]);
    expect(lightsOf(answerRequest(s, NOW, newId, { id: "r", tokenId: "g", action: "light", kind: "torch" }, ok))).toBe(s);
    expect(lightsOf(answerRequest(none, NOW, newId, { id: "r", tokenId: "g", action: "putOut" }, ok))).toBe(none);
    const out = lightsOf(answerRequest(s, NOW, newId, { id: "r", tokenId: "g", action: "putOut" }, ok));
    expect(out.lights[0].status).toBe("spent");
  });

  it("the room's cap is told, not broken", () => {
    const full = parseLights({ lights: Array.from({ length: MAX_LIGHTS }, (_, i) => lit(`t${i}`)) });
    expect(answerRequest(full, NOW, newId, { id: "r", tokenId: "g", action: "light", kind: "torch" }, ok)).toEqual({
      error: expect.stringContaining(`Up to ${MAX_LIGHTS}`),
    });
  });

  it("of two GM clients, the lowest connection id answers", () => {
    const gm = (connectionId: string) => ({ connectionId, role: "GM" }) as Player;
    const player = (connectionId: string) => ({ connectionId, role: "PLAYER" }) as Player;
    expect(leadsGms("b", [player("a"), gm("c")])).toBe(true);
    expect(leadsGms("b", [gm("a")])).toBe(false);
  });
});

describe("watchLightRequests (the GM's background)", () => {
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const setup = (settings: object = { playersLight: true }) => {
    obr.role = "GM";
    obr.connectionId = "gm-1";
    obr.party = [{ id: "greg", connectionId: "greg-1", role: "PLAYER" } as Player];
    obr.items = [greg];
    obr.metadata = { [SETTINGS_KEY]: settings };
    return watchLightRequests();
  };
  const replies = () => vi.mocked(OBR.broadcast.sendMessage).mock.calls.filter((c) => c[0] === REPLY_CHANNEL).map((c) => c[1]);

  it("writes the player's light and answers them; not an undo step", async () => {
    const off = setup();
    await receiveBroadcast(REQUEST_CHANNEL, { id: "r1", tokenId: "g", action: "light", kind: "torch" }, "greg-1");
    await settle();
    expect(parseLights(obr.metadata[LIGHTS_KEY]).lights).toMatchObject([{ kind: "torch", tokenId: "g", status: "lit" }]);
    expect(replies()).toEqual([{ id: "r1", error: null }]);
    expect(sessionStorage.length).toBe(0);
    off();
  });

  it("refuses with the setting off, and a request from someone who didn't place the token", async () => {
    const off = setup({ playersLight: false });
    await receiveBroadcast(REQUEST_CHANNEL, { id: "r1", tokenId: "g", action: "light", kind: "torch" }, "greg-1");
    await settle();
    expect(replies()).toEqual([{ id: "r1", error: NOT_ALLOWED }]);
    obr.metadata = { [SETTINGS_KEY]: { playersLight: true } };
    obr.party.push({ id: "steve", connectionId: "steve-1", role: "PLAYER" } as Player);
    await receiveBroadcast(REQUEST_CHANNEL, { id: "r2", tokenId: "g", action: "light", kind: "torch" }, "steve-1");
    await settle();
    expect(replies()[1]).toMatchObject({ id: "r2", error: expect.any(String) });
    expect(obr.metadata[LIGHTS_KEY]).toBeUndefined();
    off();
  });

  it("players' clients and a second GM client don't answer", async () => {
    const off = setup();
    obr.role = "PLAYER";
    await receiveBroadcast(REQUEST_CHANNEL, { id: "r1", tokenId: "g", action: "light", kind: "torch" }, "greg-1");
    await settle();
    obr.role = "GM";
    obr.party.push({ id: "gm", connectionId: "gm-0", role: "GM" } as Player);
    await receiveBroadcast(REQUEST_CHANNEL, { id: "r2", tokenId: "g", action: "light", kind: "torch" }, "greg-1");
    await settle();
    expect(OBR.broadcast.sendMessage).not.toHaveBeenCalled();
    expect(obr.metadata[LIGHTS_KEY]).toBeUndefined();
    off();
  });
});

describe("requestLight (the player's panel)", () => {
  it("resolves with the GM's answer to this request, ignoring others'", async () => {
    const answer = requestLight({ tokenId: "g", action: "light", kind: "torch" });
    const sent = vi.mocked(OBR.broadcast.sendMessage).mock.calls[0];
    expect(sent[0]).toBe(REQUEST_CHANNEL);
    const id = (sent[1] as { id: string }).id;
    await receiveBroadcast(REPLY_CHANNEL, { id: "someone-else", error: "no" });
    await receiveBroadcast(REPLY_CHANNEL, { id, error: null });
    await expect(answer).resolves.toBeNull();
  });

  it("no GM answering: says so after a while", async () => {
    vi.useFakeTimers();
    try {
      const answer = requestLight({ tokenId: "g", action: "putOut" });
      await vi.advanceTimersByTimeAsync(REPLY_TIMEOUT_MS);
      await expect(answer).resolves.toMatch(/Is the GM in the room/);
    } finally {
      vi.useRealTimers();
    }
  });
});
