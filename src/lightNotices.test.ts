import { describe, it, expect, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY } from "./constants";
import { MINUTE, parseLights, putOut, timePasses } from "./lights";
import { TIME_PASSES_CHANNEL, formatSpan, outMessage, watchLightNotices, wentOut } from "./lightNotices";
import { obr, receiveBroadcast, writeFromElsewhere } from "./test/obrMock";

const NOW = 1_000_000;
const torch = (id: string, carrier: string, endsAt = NOW + 60 * MINUTE) => ({ id, kind: "torch", tokenId: `t-${id}`, carrier, status: "lit", remainingMs: 60 * MINUTE, endsAt });

describe("wentOut", () => {
  const s = parseLights({ lights: [torch("a", "Aria"), torch("b", "Bram", NOW + 1000), { ...torch("c", "Cas"), kind: "lantern" }] });

  it("burned out (ran to its end, settled or not) versus put out; removed says nothing", () => {
    const later = NOW + 2000;
    const after = putOut(s, later, "c");
    expect(outMessage(wentOut(s, NOW, after, later))).toBe("Torch (Bram) burned out. Lantern (Cas) went out.");
    const removed = { ...s, lights: s.lights.filter((l) => l.id !== "a") };
    expect(wentOut(s, NOW, removed, NOW)).toEqual({ burned: [], out: [] });
  });

  it("time passing past a light's end puts it out", () => {
    const after = timePasses(s, NOW, 61 * MINUTE);
    expect(outMessage(wentOut(s, NOW, after, NOW))).toBe("Torch (Aria), Torch (Bram), Lantern (Cas) went out.");
  });

  it("spans", () => {
    expect(formatSpan(10 * MINUTE)).toBe("10 minutes");
    expect(formatSpan(90 * MINUTE)).toBe("1 hour 30 minutes");
    expect(formatSpan(60 * MINUTE)).toBe("1 hour");
  });
});

describe("watchLightNotices (every client)", () => {
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const shown = () => vi.mocked(OBR.notification.show).mock.calls.map((c) => c[0]);

  it("nothing for what's already out when the room loads; then a put-out light, and Time passes from the GM", async () => {
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...torch("a", "Aria"), status: "spent", remainingMs: 0, endsAt: null }] } };
    const off = watchLightNotices();
    await settle();
    expect(shown()).toEqual([]);
    const lit = { ...torch("b", "Bram"), endsAt: Date.now() + 60 * MINUTE };
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [lit] } });
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [{ ...lit, status: "spent", remainingMs: 0, endsAt: null, spentAt: Date.now() }] } });
    await settle();
    expect(shown()).toEqual(["Torch (Bram) went out."]);
    receiveBroadcast(TIME_PASSES_CHANNEL, { ms: 10 * MINUTE });
    receiveBroadcast(TIME_PASSES_CHANNEL, { ms: "lots" });
    await settle();
    expect(shown()).toEqual(["Torch (Bram) went out.", "Time passes: 10 minutes."]);
    off();
  });

  it("a burn-out is noticed on the client's own timer, with no write", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...torch("a", "Aria"), endsAt: Date.now() + 1000 }] } };
      const off = watchLightNotices();
      await vi.advanceTimersByTimeAsync(10);
      expect(shown()).toEqual([]);
      await vi.advanceTimersByTimeAsync(1100);
      expect(shown()).toEqual(["Torch (Aria) burned out."]);
      off();
    } finally {
      vi.useRealTimers();
    }
  });
});
