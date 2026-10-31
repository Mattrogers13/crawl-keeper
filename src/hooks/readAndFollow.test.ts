import { describe, it, expect, vi, afterEach } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { readAndFollow } from "./readAndFollow";

// A read that fails `fails` times, then answers `value`; and a change feed.
const source = (fails: number, value = "v") => {
  let emit: (v: string) => void = () => {};
  const off = vi.fn();
  const read = vi.fn(() => (fails-- > 0 ? Promise.reject(new Error("offline")) : Promise.resolve(value)));
  const follow = (take: (v: string) => void) => {
    emit = take;
    return off;
  };
  return { read, follow, off, emit: (v: string) => emit(v) };
};

describe("readAndFollow", () => {
  afterEach(() => vi.useRealTimers());

  it("retries a failed read, backing off 2 s, 4 s, 8 s", async () => {
    vi.useFakeTimers();
    const s = source(3);
    const take = vi.fn();
    readAndFollow({ read: s.read, follow: s.follow, take, what: "x" });
    await vi.advanceTimersByTimeAsync(0);
    expect(s.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(s.read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(7999);
    expect(take).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(take).toHaveBeenCalledWith("v");
  });

  it("tells the user once, on the given failure; never without notify", async () => {
    vi.useFakeTimers();
    const told = readAndFollow({ ...source(5), take: () => {}, what: "x", notify: { after: 2, message: "Stuck" } });
    await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000);
    expect(OBR.notification.show).toHaveBeenCalledTimes(1);
    expect(OBR.notification.show).toHaveBeenCalledWith("Stuck: offline", "ERROR");
    told();
    vi.mocked(OBR.notification.show).mockClear();
    readAndFollow({ ...source(5), take: () => {}, what: "x" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(OBR.notification.show).not.toHaveBeenCalled();
  });

  it("a change event beats a slower read", async () => {
    let answer!: (v: string) => void;
    const s = source(0);
    const take = vi.fn();
    readAndFollow({ read: () => new Promise<string>((r) => (answer = r)), follow: s.follow, take, what: "x" });
    s.emit("new");
    answer("old");
    await Promise.resolve();
    await Promise.resolve();
    expect(take.mock.calls).toEqual([["new"]]);
  });

  it("stopping unsubscribes and ends the retries", async () => {
    vi.useFakeTimers();
    const s = source(10);
    const stop = readAndFollow({ read: s.read, follow: s.follow, take: () => {}, what: "x" });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(s.off).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.read).toHaveBeenCalledTimes(1);
  });
});
