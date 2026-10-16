import { describe, it, expect } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { createMenu, toggleInitiative } from "./background";
import { TRACKER_KEY } from "./constants";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr } from "./test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);

describe("background: Add / Remove Initiative", () => {
  it("adds untracked tokens, then removes them on a second click", async () => {
    await toggleInitiative(["a", "b"]);
    expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY, "a", "b"]);
    await toggleInitiative(["a", "b"]);
    expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY]);
  });

  it("reads the scene fresh and keeps malformed data out", async () => {
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "x", roll: 3 }, "junk"], current: "x", round: 2 } };
    await toggleInitiative(["y"]);
    expect(saved()).toMatchObject({ current: "x", round: 2 });
    expect(saved().entries.map((e) => e.id)).toEqual(["x", GM_ENTRY, "y"]);
  });

  it("registers a GM-only menu on character and mount images", async () => {
    await createMenu();
    const menu = vi.mocked(OBR.contextMenu.create).mock.calls[0][0];
    expect(menu.icons[0].filter?.roles).toEqual(["GM"]);
    expect(menu.icons[0].icon).toBe("/img/initiative.svg");
  });
});
