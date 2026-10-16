import { describe, it, expect, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { flushWrite, obr, writeFromElsewhere } from "./obrMock";

// The mock's contract. If a test elsewhere relies on SDK behavior, pin it here.
describe("OBR mock", () => {
  it("is what @owlbear-rodeo/sdk resolves to in tests", () => {
    expect(OBR.isAvailable).toBe(true);
    expect(vi.isMockFunction(OBR.room.setMetadata)).toBe(true);
  });

  it("merges top-level metadata keys and echoes to every listener, the writer included", async () => {
    const seen: unknown[] = [];
    const off = OBR.room.onMetadataChange((m) => seen.push(m));
    await OBR.room.setMetadata({ a: 1 });
    await OBR.room.setMetadata({ b: 2 });
    expect(await OBR.room.getMetadata()).toEqual({ a: 1, b: 2 });
    expect(seen).toEqual([{ a: 1 }, { a: 1, b: 2 }]);
    off();
    await OBR.room.setMetadata({ c: 3 });
    expect(seen).toHaveLength(2);
  });

  it("holds deferred writes until flushed, in order", async () => {
    obr.deferWrites = true;
    let saved = false;
    OBR.room.setMetadata({ a: 1 }).then(() => (saved = true));
    expect(obr.metadata).toEqual({});
    await flushWrite();
    expect(obr.metadata).toEqual({ a: 1 });
    expect(saved).toBe(true);
  });

  it("rejects writes while failWrites is set", async () => {
    obr.failWrites = true;
    await expect(OBR.room.setMetadata({ a: 1 })).rejects.toThrow();
    expect(obr.metadata).toEqual({});
  });

  it("is reset between tests", async () => {
    expect(obr.metadata).toEqual({});
    expect(obr.role).toBe("GM");
    await writeFromElsewhere({ x: 1 });
    expect(obr.metadata).toEqual({ x: 1 });
  });
});
