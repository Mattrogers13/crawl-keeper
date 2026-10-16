import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import { useRoomValue } from "./useRoomValue";
import { obr, writeFromElsewhere } from "../test/obrMock";

const parse = (raw: unknown) => (typeof raw === "number" ? raw : 0);
const KEY = "test/count";

describe("useRoomValue", () => {
  it("reads the room's value through parse", async () => {
    obr.metadata = { [KEY]: 5 };
    const { result } = renderHook(() => useRoomValue(KEY, parse));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe(5);
  });

  it("parses malformed room data instead of trusting it", async () => {
    obr.metadata = { [KEY]: "not a number" };
    const { result } = renderHook(() => useRoomValue(KEY, parse));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe(0);
  });

  it("refuses to write before the first read lands (it would wipe the room)", async () => {
    obr.metadata = { [KEY]: 5 };
    let release!: () => void;
    vi.spyOn(OBR.room, "getMetadata").mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(obr.metadata))),
    );
    const { result } = renderHook(() => useRoomValue(KEY, parse));
    let saved = true;
    await act(async () => {
      saved = await result.current.write(1);
    });
    expect(saved).toBe(false);
    expect(OBR.room.setMetadata).not.toHaveBeenCalled();
    await act(async () => release());
    expect(result.current.value).toBe(5);
  });

  it("treats a new key as unloaded until its first read lands", async () => {
    obr.metadata = { a: 1, b: 2 };
    const { result, rerender } = renderHook(({ k }) => useRoomValue(k, parse), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let release!: () => void;
    vi.spyOn(OBR.room, "getMetadata").mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(obr.metadata))),
    );
    rerender({ k: "b" });
    expect(result.current.loaded).toBe(false);
    let saved = true;
    await act(async () => {
      saved = await result.current.write(99);
    });
    expect(saved).toBe(false);
    expect(obr.metadata.b).toBe(2);
    await act(async () => release());
    expect(result.current.value).toBe(2);
  });

  it("ignores a re-read for the old key that lands after the key changed", async () => {
    obr.metadata = { a: 1, b: 2 };
    const { result, rerender } = renderHook(({ k }) => useRoomValue(k, parse), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const pending: (() => void)[] = [];
    vi.spyOn(OBR.room, "getMetadata").mockImplementation(
      () => new Promise((resolve) => pending.push(() => resolve(obr.metadata))),
    );
    obr.failWrites = true;
    await act(async () => {
      result.current.write(5); // fails, then re-reads key "a" (held)
    });
    rerender({ k: "b" }); // reads key "b" (held)
    obr.failWrites = false;
    await act(async () => pending[0]()); // the stale "a" re-read lands
    let saved = true;
    await act(async () => {
      saved = await result.current.write(99);
    });
    expect(saved).toBe(false);
    expect(obr.metadata.b).toBe(2);
  });

  it("follows other clients' writes", async () => {
    const { result } = renderHook(() => useRoomValue(KEY, parse));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await writeFromElsewhere({ [KEY]: 9 });
    expect(result.current.value).toBe(9);
  });

  it("doesn't re-render for other keys (e.g. other extensions)", async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useRoomValue(KEY, parse);
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const before = renders;
    await writeFromElsewhere({ "other.extension/state": { big: true } });
    expect(renders).toBe(before);
  });

  it("saves, and puts the room's value back when a save fails", async () => {
    obr.metadata = { [KEY]: 5 };
    const { result } = renderHook(() => useRoomValue(KEY, parse));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      expect(await result.current.write(6)).toBe(true);
    });
    expect(obr.metadata[KEY]).toBe(6);

    obr.failWrites = true;
    await act(async () => {
      expect(await result.current.write(7)).toBe(false);
    });
    expect(result.current.value).toBe(6);
    expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"), "ERROR");
  });

  it("retries a failed first read", async () => {
    vi.useFakeTimers();
    try {
      obr.metadata = { [KEY]: 3 };
      vi.spyOn(OBR.room, "getMetadata").mockRejectedValueOnce(new Error("offline"));
      const { result } = renderHook(() => useRoomValue(KEY, parse));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.loaded).toBe(true);
      expect(result.current.value).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
