import { describe, it, expect, vi } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { flushWrite, obr, setItems, setSceneReady, token, writeFromElsewhere } from "./obrMock";

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

  it("keeps scene metadata separate from the room and echoes scene writes", async () => {
    const seen: unknown[] = [];
    const off = OBR.scene.onMetadataChange((m) => seen.push(m));
    await OBR.scene.setMetadata({ s: 1 });
    expect(await OBR.scene.getMetadata()).toEqual({ s: 1 });
    expect(obr.metadata).toEqual({});
    expect(seen).toEqual([{ s: 1 }]);
    off();
  });

  it("refuses scene calls while no scene is open", async () => {
    obr.sceneReady = false;
    expect(await OBR.scene.isReady()).toBe(false);
    await expect(OBR.scene.getMetadata()).rejects.toThrow();
    await expect(OBR.scene.setMetadata({ s: 1 })).rejects.toThrow();
    await expect(OBR.scene.items.getItems()).rejects.toThrow();
  });

  it("reports scene opens and item changes to subscribers", async () => {
    const ready: boolean[] = [];
    const items: string[][] = [];
    OBR.scene.onReadyChange((r) => ready.push(r));
    OBR.scene.items.onChange((all) => items.push(all.map((i) => i.id)));
    await setSceneReady(false);
    await setSceneReady(true, { items: [token("a")] });
    await setItems([token("a"), token("b")]);
    expect(ready).toEqual([false, true]);
    expect(items).toEqual([["a", "b"]]);
    expect((await OBR.scene.items.getItems(["b"])).map((i) => i.id)).toEqual(["b"]);
  });
});
