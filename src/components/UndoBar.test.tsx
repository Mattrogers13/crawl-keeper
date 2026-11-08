import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { record } from "../undo";
import { changePlayer, obr, token } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const scene = (entries: { id: string; monster?: boolean }[], current: string | null = null, round = 0) => {
  obr.sceneMetadata = { [TRACKER_KEY]: { entries: entries.map((e) => ({ roll: null, note: "", dead: false, ...e })), current, round } };
};

describe("the GM's undo in the panel", () => {
  it("names the step; Undo and Redo take a turn back and forward", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Next turn" }));
    await waitFor(() => expect(saved()).toMatchObject({ current: null, round: 0 }));
    fireEvent.click(await screen.findByRole("button", { name: "Redo: Next turn" }));
    await waitFor(() => expect(saved()).toMatchObject({ current: "a", round: 1 }));
  });

  it("Undo names its step on the button; Redo is an icon whose tooltip names it", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Next turn" }));
    const redo = await screen.findByRole("button", { name: "Redo: Next turn" });
    expect(redo).toHaveTextContent(/^$/);
    expect(redo).toHaveAttribute("title", "Redo: Next turn (⇧⌘Z)");
    fireEvent.click(redo);
    expect(await screen.findByRole("button", { name: "Undo: Next turn" })).toHaveTextContent("Undo: Next turn");
  });

  it("Cmd+Z undoes and Cmd+Shift+Z redoes, but not while typing in a field", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await screen.findByRole("button", { name: "Undo: Next turn" });
    fireEvent.keyDown(screen.getByLabelText("Note for GM / Monsters"), { key: "z", metaKey: true });
    expect(saved().current).toBe("a");
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    await waitFor(() => expect(saved().current).toBeNull());
    fireEvent.keyDown(document.body, { key: "z", metaKey: true, shiftKey: true });
    await waitFor(() => expect(saved().current).toBe("a"));
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    await waitFor(() => expect(saved().current).toBeNull());
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    await waitFor(() => expect(saved().current).toBe("a"));
  });

  it("no toast: a bigger action names itself in the bar, which undoes it", async () => {
    obr.items = [token("a", { name: "Aria" }), token("m", { name: "Goblin" })];
    scene([{ id: "a" }, { id: GM_ENTRY }, { id: "m", monster: true }]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove monsters" }));
    const undoIt = await screen.findByRole("button", { name: "Undo: Remove monsters" });
    expect(screen.queryByText(/Done:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    fireEvent.click(undoIt);
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toContain("m"));
  });

  it("works from Settings too: a setting is a step", async () => {
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    fireEvent.click(await screen.findByRole("switch", { name: /Show rounds to players/ }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ showRound: false }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Setting: show rounds" }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ showRound: true }));
  });

  it("players get no undo, even in a tab with history", async () => {
    await record("Next turn", [{ store: "room", key: SETTINGS_KEY, before: 1, after: 2 }]);
    await changePlayer({ role: "PLAYER" });
    obr.role = "PLAYER";
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("GM / Monsters");
    expect(screen.queryByRole("button", { name: /Undo/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Undo/)).not.toBeInTheDocument();
  });
});
