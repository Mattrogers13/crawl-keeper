import { afterEach, describe, expect, it, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { TRACKER_KEY } from "./constants";
import { describeResult, runSceneSizeTest, SIZE_TEST_KEY } from "./sceneSizeTest";
import { obr } from "./test/obrMock";

const setMetadata = vi.mocked(OBR.scene.setMetadata);
const original = setMetadata.getMockImplementation()!;
afterEach(() => setMetadata.mockImplementation(original));

// A scene that rejects any write leaving it over `capKB` in total.
const capAt = (capKB: number) =>
  setMetadata.mockImplementation(async (update) => {
    const next = { ...obr.sceneMetadata, ...update };
    if (new Blob([JSON.stringify(next)]).size > capKB * 1000) throw { message: "Metadata too large" };
    return original(update);
  });

describe("scene size test (Dev)", () => {
  it("climbs every step when there's no cap, then deletes the key", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [] } };
    const r = await runSceneSizeTest();
    expect(r.steps.map((s) => s.ok)).toEqual([true, true, true, true]);
    expect(obr.sceneMetadata[SIZE_TEST_KEY]).toBeUndefined();
    expect(obr.sceneMetadata[TRACKER_KEY]).toEqual({ entries: [] });
    expect(describeResult(r)).toMatch(/No cap reached.*Test key deleted/);
  });

  it("stops at the first rejected size and still deletes the key", async () => {
    capAt(16);
    const r = await runSceneSizeTest();
    expect(r.steps).toEqual([
      expect.objectContaining({ keyKB: 15, ok: true }),
      expect.objectContaining({ keyKB: 20, ok: false, error: "Metadata too large" }),
    ]);
    expect(obr.sceneMetadata[SIZE_TEST_KEY]).toBeUndefined();
    expect(describeResult(r)).toMatch(/Accepted up to 15.1 kB total\. Rejected at 20.1 kB total: Metadata too large\./);
  });

  it("counts other extensions' keys in the total", async () => {
    obr.sceneMetadata = { "other.ext/data": "y".repeat(2000) };
    capAt(16);
    const r = await runSceneSizeTest();
    expect(r.beforeKB).toBe(2);
    expect(r.steps).toEqual([expect.objectContaining({ keyKB: 15, ok: false })]);
    expect(describeResult(r)).toMatch(/No size was accepted/);
  });

  it("shrinks the key to null if undefined doesn't delete it", async () => {
    capAt(1000);
    setMetadata.mockImplementation(async (update) =>
      // A host that ignores undefined values (keeps the old one).
      original(Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined))),
    );
    const r = await runSceneSizeTest();
    expect(r.deleted).toBe(false);
    expect(obr.sceneMetadata[SIZE_TEST_KEY]).toBeNull();
    expect(describeResult(r)).toMatch(/set to null/);
  });
});
