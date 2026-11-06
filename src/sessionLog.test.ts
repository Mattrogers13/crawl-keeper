import { describe, expect, it, vi } from "vitest";

import { ID } from "./constants";
import { clearLog, LOG_MAX, logEvent, logText, onLogChange, parseLog, readLog } from "./sessionLog";

describe("session log", () => {
  it("newest first, per room, capped; Clear empties it and tells listeners", () => {
    const heard = vi.fn();
    const off = onLogChange(heard);
    logEvent("Torch (Aria) burned out.", "light", 1000);
    logEvent("Time passes: 10 minutes.", "time", 2000);
    expect(readLog()).toEqual([
      { at: 2000, text: "Time passes: 10 minutes.", kind: "time" },
      { at: 1000, text: "Torch (Aria) burned out.", kind: "light" },
    ]);
    expect(localStorage.getItem(`${ID}/log/room-1`)).not.toBeNull();
    for (let i = 0; i < LOG_MAX + 5; i++) logEvent(`e${i}`, "effect", 3000 + i);
    expect(readLog()).toHaveLength(LOG_MAX);
    expect(readLog()[0].text).toBe(`e${LOG_MAX + 4}`);
    clearLog();
    expect(readLog()).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(LOG_MAX + 8);
    off();
    logEvent("after", "focus");
    expect(heard).toHaveBeenCalledTimes(LOG_MAX + 8);
  });

  it("parses untrusted storage: junk drops, bad kinds fall back, long text is cut", () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog("not json")).toEqual([]);
    expect(parseLog('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([{ at: 5, text: "ok", kind: "light" }, { at: "x", text: "bad" }, null, { at: 6, text: "  " }, { at: 7, text: "y".repeat(400), kind: "nope" }]);
    expect(parseLog(raw)).toEqual([
      { at: 5, text: "ok", kind: "light" },
      { at: 7, text: "y".repeat(300), kind: "effect" },
    ]);
  });

  it("the download is oldest first", () => {
    logEvent("first", "light", Date.UTC(2026, 10, 6, 15, 0));
    logEvent("second", "time", Date.UTC(2026, 10, 6, 15, 5));
    const text = logText(readLog());
    expect(text.indexOf("first")).toBeLessThan(text.indexOf("second"));
  });
});
