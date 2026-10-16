import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, setItems, setSceneReady, token, writeSceneFromElsewhere } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const rows = () => screen.getAllByRole("listitem");
const rowOf = (name: string) => rows().find((r) => within(r).queryByText(name))!;

const scene = (entries: { id: string; roll?: number | null; note?: string }[], current: string | null = null, round = 0) => {
  obr.sceneMetadata = {
    [TRACKER_KEY]: { entries: entries.map((e) => ({ roll: null, note: "", ...e })), current, round },
  };
};

describe("Tracker (GM)", () => {
  it("starts, advances and wraps the round, saving to the scene", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Start"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "a", round: 1 }));
    expect(rowOf("Aria")).toHaveAttribute("aria-current", "step");
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "a", round: 2 }));
    expect(screen.getByText("Round 2")).toBeInTheDocument();
  });

  it("edits rolls and notes, and sorts by roll", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    const roll = await screen.findByLabelText("Initiative for Borin");
    fireEvent.change(roll, { target: { value: "17" } });
    fireEvent.blur(roll);
    await waitFor(() => expect(saved().entries[1].roll).toBe(17));
    const note = screen.getByLabelText("Note for Aria");
    fireEvent.change(note, { target: { value: "Has the key" } });
    fireEvent.blur(note);
    await waitFor(() => expect(saved().entries[0].note).toBe("Has the key"));
    fireEvent.click(screen.getByLabelText("Sort by roll"));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["b", "a", GM_ENTRY]));
  });

  it("rejects an out-of-range roll and keeps the old value", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", roll: 5 }, { id: GM_ENTRY }]);
    render(<App />);
    const roll = await screen.findByLabelText("Initiative for Aria");
    fireEvent.change(roll, { target: { value: "abc" } });
    fireEvent.blur(roll);
    expect(roll).toHaveValue("5");
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
  });

  it("table order: highest roll goes first, then round the seating", async () => {
    obr.metadata = { [SETTINGS_KEY]: { orderMode: "table" } };
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a", roll: 4 }, { id: GM_ENTRY, roll: 9 }, { id: "b", roll: 15 }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Start"));
    await waitFor(() => expect(saved().current).toBe("b"));
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "a", round: 1 }));
  });

  it("switches order mode and hides the round in room settings", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Table order"));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ orderMode: "table" }));
    fireEvent.click(screen.getByLabelText("Hide round"));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ orderMode: "table", hideRound: true }));
  });

  it("drops a token deleted from the map and saves without it on the next edit", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    await screen.findByText("Aria");
    await setItems([token("b", { name: "Borin" })]);
    expect(screen.queryByText("Aria")).not.toBeInTheDocument();
    expect(rowOf("Borin")).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["b", GM_ENTRY]));
  });

  it("removes a token but never the GM row", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Remove Aria"));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY]));
    expect(screen.queryByLabelText("Remove GM / Monsters")).not.toBeInTheDocument();
  });

  it("puts the scene's value back and tells the GM when a save fails", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    obr.failWrites = true;
    fireEvent.click(await screen.findByText("Start"));
    await waitFor(() => expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"), "ERROR"));
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});

describe("Tracker (player)", () => {
  it("is read-only and shows notes", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", roll: 12, note: "Blessed until round 4" }, { id: GM_ENTRY }], "a", 3);
    render(<App />);
    expect(await screen.findByText("Blessed until round 4")).toBeInTheDocument();
    expect(screen.getByText("Round 3")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("never shows hidden tokens; a hidden token's turn shows as the GM's", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a", { name: "Aria" }), token("m", { name: "Lurker", visible: false })];
    scene([{ id: "a" }, { id: "m" }, { id: GM_ENTRY }], "m", 1);
    render(<App />);
    await screen.findByText("Aria");
    expect(screen.queryByText("Lurker")).not.toBeInTheDocument();
    expect(rowOf("GM / Monsters")).toHaveAttribute("aria-current", "step");
  });

  it("hides the round when the GM says so", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [SETTINGS_KEY]: { hideRound: true } };
    scene([{ id: GM_ENTRY }], GM_ENTRY, 4);
    render(<App />);
    expect(await screen.findByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText("Round 4")).not.toBeInTheDocument();
  });

  it("follows the GM's changes live", async () => {
    obr.role = "PLAYER";
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("Not started");
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: GM_ENTRY }], current: GM_ENTRY, round: 1 } });
    expect(screen.getByText("Round 1")).toBeInTheDocument();
  });
});

describe("Scenes", () => {
  it("asks for a scene when none is open, and reads each map's tracker fresh", async () => {
    obr.sceneReady = false;
    render(<App />);
    expect(await screen.findByText("Open a scene to use the tracker.")).toBeInTheDocument();
    expect(OBR.scene.getMetadata).not.toHaveBeenCalled();
    await setSceneReady(true, {
      metadata: { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } },
      items: [token("a", { name: "Map One Hero" })],
    });
    expect(await screen.findByText("Map One Hero")).toBeInTheDocument();
    await setSceneReady(false);
    await setSceneReady(true, {
      metadata: { [TRACKER_KEY]: { entries: [{ id: "b" }, { id: GM_ENTRY }] } },
      items: [token("b", { name: "Map Two Hero" })],
    });
    expect(await screen.findByText("Map Two Hero")).toBeInTheDocument();
    expect(screen.queryByText("Map One Hero")).not.toBeInTheDocument();
  });
});
