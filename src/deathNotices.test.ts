import { describe, expect, it, vi } from "vitest";

import OBR from "@owlbear-rodeo/sdk";

import { deathMessage, DYING_CHANNEL, parseDeathEvent, watchDeathNotices } from "./deathNotices";
import { readLog } from "./sessionLog";
import { receiveBroadcast } from "./test/obrMock";

describe("death notices", () => {
  it("parse untrusted events: names trimmed and capped, numbers in range, unknown events dropped", () => {
    expect(parseDeathEvent({ event: "started", name: " Aria ", rounds: 3, d4: 2, con: 1 })).toEqual({ event: "started", name: "Aria", rounds: 3, d4: 2, con: 1 });
    expect(parseDeathEvent({ event: "started", name: "Aria", rounds: 3, d4: 9, con: "x" })).toEqual({ event: "started", name: "Aria", rounds: 3, d4: null, con: null });
    expect(parseDeathEvent({ event: "rolled", name: "Aria", value: 21 })).toBeNull();
    expect(parseDeathEvent({ event: "rises", name: "" })).toBeNull();
    expect(parseDeathEvent({ event: "explodes", name: "Aria" })).toBeNull();
    expect(parseDeathEvent("nope")).toBeNull();
    expect(parseDeathEvent({ event: "died", name: "x".repeat(100) })?.name).toHaveLength(64);
  });

  it("says what happened", () => {
    expect(deathMessage({ event: "started", name: "Aria", rounds: 3, d4: 2, con: 1 })).toBe("Aria is dying: dies in 3 rounds (d4 2 + 1 CON).");
    expect(deathMessage({ event: "started", name: "Aria", rounds: 1, d4: null, con: null })).toBe("Aria is dying: dies in 1 round.");
    expect(deathMessage({ event: "rolled", name: "Aria", value: 20 })).toBe("Aria rolls a natural 20 on the death d20!");
    expect(deathMessage({ event: "died", name: "Aria" })).toBe("Aria died.");
  });

  it("every client shows it and logs it; garbage is ignored", async () => {
    const off = watchDeathNotices();
    await receiveBroadcast(DYING_CHANNEL, { event: "rolled", name: "Aria", value: 7 });
    await receiveBroadcast(DYING_CHANNEL, { event: "rolled", name: "Aria", value: "seven" });
    expect(vi.mocked(OBR.notification.show).mock.calls.map((c) => c[0])).toEqual(["Aria rolls 7 on the death d20."]);
    expect(readLog().map((e) => e.text)).toEqual(["Aria rolls 7 on the death d20."]);
    off();
  });
});
