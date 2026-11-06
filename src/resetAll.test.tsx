import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import OBR from "@owlbear-rodeo/sdk";

import App from "./components/App";
import { EFFECTS_KEY, LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { MINUTE } from "./lights";
import { resetAll, resetTracker } from "./resetAll";
import { readLog } from "./sessionLog";
import { obr, token } from "./test/obrMock";
import { emptyTracker, GM_ENTRY, parseTracker } from "./tracker";
import { undo } from "./undo";

const entries = [{ id: "a", roll: 15 }, { id: GM_ENTRY, roll: 9, note: "Goblins" }, { id: "g", monster: true }].map((e) => ({
  roll: null,
  note: "",
  dead: false,
  ...e,
}));
const setup = () => {
  const now = Date.now();
  obr.items = [token("a", { name: "Aria" }), token("g", { name: "Gob" })];
  obr.sceneMetadata = {
    [TRACKER_KEY]: { entries, current: "a", round: 4, phase: "combat", gmMod: 2, crawl: { danger: "deadly", crawlRounds: 4, clock: 7 } },
    [EFFECTS_KEY]: { effects: [{ id: "e1", name: "Bless", kind: "until", holder: "a" }] },
  };
  obr.metadata = {
    [LIGHTS_KEY]: { paused: true, lightingRule: "rideAlong", lights: [{ id: "l1", kind: "torch", tokenId: "a", carrier: "Aria", status: "lit", remainingMs: 30 * MINUTE, endsAt: now + 30 * MINUTE }] },
  };
};

describe("Reset all", () => {
  it("pure: the GM row alone, rounds, phase and clock reset; the danger level stays", () => {
    const after = resetTracker(parseTracker(obr.sceneMetadata[TRACKER_KEY] ?? { entries, crawl: { danger: "risky", clock: 3 } }));
    expect(after).toEqual({ ...emptyTracker(), crawl: { ...emptyTracker().crawl, danger: "risky" } });
  });

  it("clears tracker, effects and lights in one undo step, and logs it; undo brings it all back", async () => {
    setup();
    await resetAll();
    const t = parseTracker(obr.sceneMetadata[TRACKER_KEY]);
    expect(t.entries.map((e) => e.id)).toEqual([GM_ENTRY]);
    expect(t).toMatchObject({ round: 0, current: null, phase: "crawl", gmMod: 0, crawl: { danger: "deadly", crawlRounds: 0 } });
    expect(obr.sceneMetadata[EFFECTS_KEY]).toEqual({ effects: [] });
    expect(obr.metadata[LIGHTS_KEY]).toMatchObject({ paused: false, lights: [] });
    expect(readLog()[0].text).toBe("Reset all: the tracker, effects and lights were cleared.");
    await undo();
    expect(parseTracker(obr.sceneMetadata[TRACKER_KEY]).entries.map((e) => e.id)).toEqual(["a", GM_ENTRY, "g"]);
    expect(obr.sceneMetadata[EFFECTS_KEY]).toMatchObject({ effects: [{ id: "e1" }] });
    expect(obr.metadata[LIGHTS_KEY]).toMatchObject({ lights: [{ id: "l1" }] });
  });

  it("if the lights can't be written, the map is put back and it says so", async () => {
    setup();
    const before = structuredClone(obr.sceneMetadata);
    vi.spyOn(OBR.room, "setMetadata").mockRejectedValueOnce(new Error("Room is full"));
    await expect(resetAll()).rejects.toThrow("Room is full");
    expect(obr.sceneMetadata[TRACKER_KEY]).toEqual(before[TRACKER_KEY]);
    expect(obr.sceneMetadata[EFFECTS_KEY]).toEqual(before[EFFECTS_KEY]);
    expect(readLog()).toEqual([]);
  });

  it("from Settings, asked first", async () => {
    setup();
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    fireEvent.click(await screen.findByRole("button", { name: "Reset all…" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reset all" }));
    await waitFor(() => expect(parseTracker(obr.sceneMetadata[TRACKER_KEY]).entries).toHaveLength(1));
    expect(await screen.findByRole("button", { name: "Undo: Reset all" })).toBeInTheDocument();
  });
});
