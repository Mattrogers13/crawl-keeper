import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { MARKER_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, setItems, setSceneReady, token, writeSceneFromElsewhere } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const rows = () => screen.getAllByRole("listitem");
// The innermost row: the GM row's item also holds its monsters' rows.
const rowOf = (name: string) => [...rows()].reverse().find((r) => within(r).queryByText(name))!;

const scene = (entries: { id: string; roll?: number | null; note?: string; dead?: boolean; monster?: boolean; hp?: { cur: number; max: number } }[], current: string | null = null, round = 0) => {
  obr.sceneMetadata = {
    [TRACKER_KEY]: { entries: entries.map((e) => ({ roll: null, note: "", dead: false, ...e })), current, round },
  };
};

describe("Tracker (GM)", () => {
  it("begins on the first ▶, advances and wraps the round, saving to the scene", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    expect(await screen.findByText("Press ▶ to begin")).toBeInTheDocument();
    expect(screen.getByLabelText("Previous turn")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Next turn"));
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


  it("switches to combat: own round count, rolls cleared; back to crawl keeps the combat order", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a", roll: 15 }, { id: "b", roll: 4 }, { id: GM_ENTRY, roll: 9 }], "b", 3);
    render(<App />);
    fireEvent.click(await screen.findByText("Combat"));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "combat", current: null, round: 3, combatRound: 0 }));
    expect(saved().entries.map((e) => e.roll)).toEqual([null, null, null]);
    expect(screen.getByText("Combat")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(screen.getByText("Round 1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Crawl"));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "crawl", round: 3, combatRound: 0 }));
    expect(saved().entries.map((e) => e.roll)).toEqual([null, null, null]);
  });

  it("keeps the rolls on combat when the setting is off", async () => {
    obr.metadata = { [SETTINGS_KEY]: { clearRollsOnCombat: false } };
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", roll: 15 }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Combat"));
    await waitFor(() => expect(saved().phase).toBe("combat"));
    expect(saved().entries[0].roll).toBe(15);
  });

  it("settings: the gear opens them, both checkboxes save to the room, back returns", async () => {
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    fireEvent.click(await screen.findByLabelText("Hide rounds from players", { exact: false }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ hideRound: true, clearRollsOnCombat: true }));
    fireEvent.click(screen.getByLabelText("Clear initiative rolls on combat", { exact: false }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ hideRound: true, clearRollsOnCombat: false }));
    fireEvent.click(screen.getByLabelText("Select the current token", { exact: false }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ selectOnTurn: false }));
    expect(screen.getByLabelText("Install link")).toHaveValue(`${window.location.origin}/manifest.json`);
    fireEvent.click(screen.getByLabelText("Back to tracker"));
    expect(await screen.findByText("GM / Monsters")).toBeInTheDocument();
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

  it("copies the install link, or selects it when the clipboard is blocked", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    fireEvent.click(await screen.findByText("Copy"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/manifest.json`);
    fireEvent.click(screen.getByText("Copy"));
    expect(await screen.findByText(/Press Cmd\+C/)).toBeInTheDocument();
  });

  it("resets the rounds only after the GM confirms", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", roll: 7 }, { id: GM_ENTRY }], "a", 5);
    render(<App />);
    fireEvent.click(await screen.findByText("Reset rounds"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Round 5")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reset rounds"));
    fireEvent.click(screen.getByText("Reset"));
    await waitFor(() => expect(saved()).toMatchObject({ current: null, round: 0, combatRound: 0 }));
    expect(saved().entries[0].roll).toBe(7);
    expect(screen.getByText("Press ▶ to begin")).toBeInTheDocument();
  });

  it("a new turn moves the marker and the selection to that token", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(obr.selection).toEqual(["a"]));
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(obr.selection).toEqual(["b"]));
    const markers = obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined);
    expect(markers.map((m) => m.attachedTo)).toEqual(["b"]);
  });

  it("tracks monster HP: set max, take damage, heal; players and the GM row have none", async () => {
    obr.items = [token("a", { name: "Ogre" }), token("p", { name: "Aria" })];
    scene([{ id: "p" }, { id: GM_ENTRY }, { id: "a", monster: true }]);
    render(<App />);
    const max = await screen.findByLabelText("Max HP for Ogre");
    fireEvent.change(max, { target: { value: "20" } });
    fireEvent.blur(max);
    await waitFor(() => expect(saved().entries[2].hp).toEqual({ cur: 20, max: 20 }));
    const cur = screen.getByLabelText("HP for Ogre");
    fireEvent.change(cur, { target: { value: "-7" } });
    fireEvent.blur(cur);
    await waitFor(() => expect(saved().entries[2].hp).toEqual({ cur: 13, max: 20 }));
    expect(screen.getByLabelText("HP for Ogre")).toHaveValue("13");
    expect(screen.queryByLabelText("HP for GM / Monsters")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HP for Aria")).not.toBeInTheDocument();
  });

  it("puts back HP it can't read", async () => {
    obr.items = [token("a", { name: "Ogre" })];
    scene([{ id: GM_ENTRY }, { id: "a", monster: true, hp: { cur: 5, max: 9 } }]);
    render(<App />);
    const cur = await screen.findByLabelText("HP for Ogre");
    fireEvent.change(cur, { target: { value: "lots" } });
    fireEvent.blur(cur);
    expect(cur).toHaveValue("5");
    expect(OBR.scene.setMetadata).not.toHaveBeenCalled();
  });

  it("lists monsters under the GM / Monsters row, with no roll box, each taking a turn", async () => {
    obr.items = [token("p", { name: "Aria" }), token("m1", { name: "Goblin" }), token("m2", { name: "Ogre" })];
    scene([{ id: "p", roll: 15 }, { id: GM_ENTRY, roll: 8 }, { id: "m1", monster: true }, { id: "m2", monster: true }]);
    render(<App />);
    const group = await screen.findByRole("list", { name: "Monsters" });
    expect(within(group).getByText("Goblin")).toBeInTheDocument();
    expect(within(rowOf("GM / Monsters")).getByText("Ogre")).toBeInTheDocument();
    expect(screen.queryByLabelText("Initiative for Goblin")).not.toBeInTheDocument();
    for (const who of ["Aria", "GM / Monsters", "Goblin", "Ogre"]) {
      fireEvent.click(screen.getByLabelText("Next turn"));
      await waitFor(() => expect(rowOf(who)).toHaveAttribute("aria-current", "step"));
    }
  });

  describe("drag to move", () => {
    afterEach(() => vi.restoreAllMocks());

    // jsdom has no layout: give each row a 40px slot in list order so the
    // keyboard drag can find its neighbours; anything else (the list itself,
    // which drags are kept inside) gets a tall box.
    const layOut = () =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const li = this.closest("li");
        const top = li ? [...li.parentElement!.children].indexOf(li) * 40 : 0;
        const height = li ? 36 : 400;
        return { x: 0, y: top, top, left: 0, bottom: top + height, right: 300, width: 300, height, toJSON() {} } as DOMRect;
      });

    it("moves a row with the grip (Space, arrow down, Space)", async () => {
      obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
      scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
      render(<App />);
      const grip = await screen.findByLabelText("Move Aria");
      layOut();
      grip.focus();
      // dnd-kit measures between key presses (effects, animation frames).
      const press = async (code: string) => {
        fireEvent.keyDown(grip, { code });
        await act(() => new Promise((r) => setTimeout(r, 50)));
      };
      await press("Space");
      await press("ArrowDown");
      await press("Space");
      await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["b", "a", GM_ENTRY]));
    });
  });

  it("marks a token dead: skipped on Next, and the turn passes if it was theirs", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Dead: Aria"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "b", round: 1 }));
    expect(saved().entries[0].dead).toBe(true);
    expect(screen.getByLabelText("Dead: Aria")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Next turn"));
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "b", round: 2 }));
    expect(screen.queryByLabelText("Dead: GM / Monsters")).not.toBeInTheDocument();
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
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(OBR.notification.show).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"), "ERROR"));
    expect(screen.getByText("Press ▶ to begin")).toBeInTheDocument();
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
    expect(screen.queryByText(/HP/)).not.toBeInTheDocument();
  });

  it("sees the monsters under the GM row, without HP", async () => {
    obr.role = "PLAYER";
    obr.items = [token("m1", { name: "Goblin" })];
    scene([{ id: GM_ENTRY }, { id: "m1", monster: true, hp: { cur: 3, max: 7 } }], "m1", 1);
    render(<App />);
    expect(await screen.findByText("Goblin")).toBeInTheDocument();
    expect(rowOf("Goblin")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText(/HP/)).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
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

  it("shows who's dead", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", dead: true }, { id: GM_ENTRY }]);
    render(<App />);
    expect(await screen.findByText("(dead)")).toBeInTheDocument();
  });

  it("hides the round when the GM says so", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [SETTINGS_KEY]: { hideRound: true } };
    scene([{ id: GM_ENTRY }], GM_ENTRY, 4);
    render(<App />);
    expect(await screen.findByText("Crawl")).toBeInTheDocument();
    expect(screen.queryByText("Round 4")).not.toBeInTheDocument();
  });

  it("follows the GM's changes live", async () => {
    obr.role = "PLAYER";
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("Crawl");
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: GM_ENTRY }], current: GM_ENTRY, round: 1 } });
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: GM_ENTRY }], phase: "combat", current: GM_ENTRY, round: 1, combatRound: 2 } });
    expect(screen.getByText("Combat")).toBeInTheDocument();
    expect(screen.getByText("Round 2")).toBeInTheDocument();
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
