import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App";
import { TOAST_MS } from "./UndoBar";
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

  it("Cmd+Z undoes and Cmd+Shift+Z redoes, but not while typing in a field", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await screen.findByRole("button", { name: "Undo: Next turn" });
    fireEvent.keyDown(screen.getByLabelText("Note for Aria"), { key: "z", metaKey: true });
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

  it("a bigger action offers Undo in a toast for 8 seconds; the next step dismisses it", async () => {
    obr.items = [token("a", { name: "Aria" }), token("m", { name: "Goblin" })];
    scene([{ id: "a" }, { id: GM_ENTRY }, { id: "m", monster: true }]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove monsters" }));
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toContain("m"));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("the toast goes after 8 seconds", async () => {
    obr.items = [token("m", { name: "Goblin" })];
    scene([{ id: GM_ENTRY }, { id: "m", monster: true }]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove monsters" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument());
    // Not before 8 seconds...
    await act(async () => vi.advanceTimersByTime(TOAST_MS - 500));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    // ...then gone. (Advanced until gone: on a slow runner the toast can
    // appear a tick later than the click, starting its timer later.)
    await waitFor(async () => {
      await act(async () => vi.advanceTimersByTime(1000));
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    });
    // The step itself stays in the bar.
    expect(screen.getByRole("button", { name: "Undo: Remove monsters" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("works from Settings too: a setting is a step", async () => {
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    fireEvent.click(await screen.findByRole("switch", { name: /Hide rounds from players/ }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ hideRound: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Setting: hide rounds" }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ hideRound: false }));
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
