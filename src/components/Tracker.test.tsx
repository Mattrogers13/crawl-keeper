import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { MARKER_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, setItems, setSceneReady, token, writeSceneFromElsewhere } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const rows = () => screen.getAllByRole("listitem");
// The GM's row menu: right-click the row, then pick an item.
const pick = async (name: string, item: string) => {
  fireEvent.contextMenu(await screen.findByText(name));
  fireEvent.click(within(await screen.findByRole("menu", { name })).getByRole("menuitem", { name: item }));
};
// The innermost row: the GM row's item also holds its monsters' rows.
const rowOf = (name: string) => [...rows()].reverse().find((r) => within(r).queryByText(name))!;

type SceneEntry = { id: string; roll?: number | null; note?: string; dead?: boolean; monster?: boolean };
const scene = (entries: SceneEntry[], current: string | null = null, round = 0, extra: object = {}) => {
  obr.sceneMetadata = {
    [TRACKER_KEY]: { entries: entries.map((e) => ({ roll: null, note: "", dead: false, ...e })), current, round, ...extra },
  };
};
const COMBAT = { phase: "combat" };

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


  it("switches to combat: the round count carries on, rolls cleared; back to crawl keeps the combat order", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a", roll: 15 }, { id: "b", roll: 4 }, { id: GM_ENTRY, roll: 9 }], "b", 3);
    render(<App />);
    fireEvent.click(await screen.findByText("Combat"));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "combat", current: null, round: 3 }));
    expect(saved().entries.map((e) => e.roll)).toEqual([null, null, null]);
    expect(screen.getByText("Combat")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(screen.getByText("Round 4")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Crawl"));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "crawl", round: 4 }));
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
    expect(await screen.findByText(/This map: .* kB tracker/)).toBeInTheDocument();
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
    await waitFor(() => expect(saved()).toMatchObject({ current: null, round: 0 }));
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

  it("lists monsters under the GM / Monsters row, with no roll box, each taking a combat turn", async () => {
    obr.items = [token("p", { name: "Aria" }), token("m1", { name: "Goblin" }), token("m2", { name: "Ogre" })];
    scene([{ id: "p", roll: 15 }, { id: GM_ENTRY, roll: 8 }, { id: "m1", monster: true }, { id: "m2", monster: true }], null, 0, {
      phase: "combat",
    });
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

  it("marks a token as a monster from its row menu, and back", async () => {
    obr.items = [token("a", { name: "Aria" }), token("o", { name: "Ogre" })];
    scene([{ id: "a", roll: 12 }, { id: "o", roll: 7 }, { id: GM_ENTRY }]);
    render(<App />);
    await pick("Ogre", "Mark as monster");
    await waitFor(() => expect(saved().entries.map((e) => [e.id, e.monster, e.roll])).toEqual([
      ["a", false, 12],
      [GM_ENTRY, false, null],
      ["o", true, null],
    ]));
    expect(within(screen.getByRole("list", { name: "Monsters" })).getByText("Ogre")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await pick("Ogre", "Mark as player or ally");
    await waitFor(() => expect(saved().entries.find((e) => e.id === "o")?.monster).toBe(false));
  });

  it("shows a token on the map by selecting it: from the menu or the portrait", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    await pick("Aria", "Show on map");
    await waitFor(() => expect(obr.selection).toEqual(["a"]));
    fireEvent.click(screen.getByLabelText("Show Borin on the map"));
    await waitFor(() => expect(obr.selection).toEqual(["b"]));
  });

  it("the ⋯ button opens the same menu; Escape and clicking away close it; none for the GM row", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Actions for Aria"));
    const menu = await screen.findByRole("menu", { name: "Aria" });
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual([
      "Mark as monster",
      "Mark dead",
      "Turn marker off",
      "Show on map",
      "Remove from initiative",
    ]);
    expect(within(menu).getByRole("menuitem", { name: "Mark as monster" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(within(menu).getByRole("menuitem", { name: "Mark dead" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText("Aria"));
    await screen.findByRole("menu");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText("GM / Monsters"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Actions for GM / Monsters")).not.toBeInTheDocument();
  });

  it("removes the monsters after a fight, only when asked and only while crawling", async () => {
    obr.items = [token("p", { name: "Aria" }), token("m1", { name: "Goblin" })];
    scene([{ id: "p" }, { id: GM_ENTRY }, { id: "m1", monster: true }], null, 0, COMBAT);
    render(<App />);
    await screen.findByText("Goblin");
    expect(screen.queryByText("Remove monsters")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Crawl"));
    fireEvent.click(await screen.findByText("Remove monsters"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Goblin")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Remove monsters"));
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["p", GM_ENTRY]));
    expect(screen.queryByText("Remove monsters")).not.toBeInTheDocument();
  });

  it("turning the marker off in Settings removes the ring now", async () => {
    obr.items = [token("p", { name: "Aria" })];
    scene([{ id: "p" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    const ringed = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo);
    await waitFor(() => expect(ringed()).toEqual(["p"]));
    fireEvent.click(screen.getByLabelText("Settings"));
    fireEvent.click(await screen.findByLabelText("Show the turn marker on the map", { exact: false }));
    await waitFor(() => expect(ringed()).toEqual([]));
    fireEvent.click(screen.getByLabelText("Back to tracker"));
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(saved().current).toBe(GM_ENTRY));
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved().current).toBe("p"));
    expect(ringed()).toEqual([]);
  });

  it("deleting the current token from the map saves the turn passing on and moves the ring", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    await screen.findByText("Aria");
    await setItems([token("b", { name: "Borin" })]);
    await waitFor(() => expect(saved()).toMatchObject({ current: "b" }));
    expect(saved().entries.map((e) => e.id)).toEqual(["b", GM_ENTRY]);
    await waitFor(() =>
      expect(obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo)).toEqual(["b"]),
    );
  });

  it("a failed save of a deleted token isn't retried in a loop", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("Aria");
    obr.failWrites = true;
    await setItems([token("b", { name: "Borin" })]);
    await waitFor(() => expect(OBR.scene.setMetadata).toHaveBeenCalledTimes(1));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(OBR.scene.setMetadata).toHaveBeenCalledTimes(1);
  });

  it("a gold dot shows which tokens get the turn marker (GM only)", async () => {
    obr.items = [token("p", { name: "Aria" }), token("m", { name: "Goblin" })];
    scene([{ id: "p" }, { id: GM_ENTRY }, { id: "m", monster: true }]);
    render(<App />);
    await screen.findByText("Aria");
    expect(within(rowOf("Aria")).getByRole("img", { name: "Turn marker on" })).toBeInTheDocument();
    expect(within(rowOf("Goblin")).queryByRole("img", { name: "Turn marker on" })).not.toBeInTheDocument();
  });

  // Showing or hiding it later: the background page (background.test.ts).
  it("a hidden token's ring starts hidden", async () => {
    obr.items = [token("a", { name: "Aria", visible: false })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(obr.items.find((i) => i.metadata[MARKER_KEY] !== undefined)?.visible).toBe(false));
  });

  it("removing the current token from the row menu passes the turn and the ring on", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    await pick("Aria", "Remove from initiative");
    await waitFor(() => expect(saved().current).toBe("b"));
    const ringed = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo);
    await waitFor(() => expect(ringed()).toEqual(["b"]));
  });

  it("rings and selects players only, unless monsters are marked too", async () => {
    obr.items = [token("p", { name: "Aria" }), token("m1", { name: "Goblin" })];
    scene([{ id: "p" }, { id: GM_ENTRY }, { id: "m1", monster: true }], GM_ENTRY, 1, COMBAT);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(rowOf("Goblin")).toHaveAttribute("aria-current", "step"));
    const ringed = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo);
    expect(ringed()).toEqual([]);
    expect(OBR.player.select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(ringed()).toEqual(["p"]));
  });

  it("a monster gets the marker when its own marker is turned on, at once if it's its turn", async () => {
    obr.items = [token("m1", { name: "Goblin" })];
    scene([{ id: GM_ENTRY }, { id: "m1", monster: true }], "m1", 1, COMBAT);
    render(<App />);
    const ringed = () => obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined).map((m) => m.attachedTo);
    await pick("Goblin", "Turn marker on");
    await waitFor(() => expect(ringed()).toEqual(["m1"]));
    expect(saved().entries[1].marker).toBe(true);
    expect(OBR.player.select).not.toHaveBeenCalled();
    await pick("Goblin", "Turn marker off");
    await waitFor(() => expect(ringed()).toEqual([]));
  });

  it("batch: click, Shift-click and Cmd-click select rows; the menu acts on all of them", async () => {
    obr.items = ["a", "b", "c", "d"].map((id) => token(id, { name: id.toUpperCase() + "name" }));
    scene([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Aname"));
    fireEvent.click(screen.getByText("Cname"), { shiftKey: true });
    const selected = () => rows().filter((r) => r.querySelector("[aria-selected=true]")).length;
    expect(selected()).toBe(3);
    fireEvent.click(screen.getByText("Bname"), { metaKey: true });
    expect(selected()).toBe(2);
    fireEvent.contextMenu(screen.getByText("Aname"));
    const menu = await screen.findByRole("menu", { name: "2 selected" });
    expect(within(menu).queryByRole("menuitem", { name: "Show on map" })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Mark as monster" }));
    await waitFor(() => expect(saved().entries.filter((e) => e.monster).map((e) => e.id)).toEqual(["a", "c"]));
    // A mixed selection offers both ways.
    fireEvent.click(screen.getByText("Bname"), { metaKey: true });
    fireEvent.contextMenu(screen.getByText("Bname"));
    const mixed = await screen.findByRole("menu", { name: "3 selected" });
    expect(within(mixed).getByRole("menuitem", { name: "Mark as monster" })).toBeInTheDocument();
    expect(within(mixed).getByRole("menuitem", { name: "Mark as player or ally" })).toBeInTheDocument();
    fireEvent.click(within(mixed).getByRole("menuitem", { name: "Remove 3 from initiative" }));
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["d", GM_ENTRY]));
    expect(selected()).toBe(0);
  });

  it("clicking in the panel outside the token rows clears the selection", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Aria"));
    fireEvent.click(screen.getByText("Borin"), { metaKey: true });
    const selected = () => rows().filter((r) => r.querySelector("[aria-selected=true]")).length;
    expect(selected()).toBe(2);
    fireEvent.click(screen.getByText("GM / Monsters"));
    expect(selected()).toBe(0);
    fireEvent.click(screen.getByText("Aria"));
    fireEvent.click(screen.getByLabelText("Sort by roll"));
    expect(selected()).toBe(0);
  });

  it("right-clicking outside the selection acts on that row only; Escape clears the selection", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByText("Aria"));
    fireEvent.contextMenu(screen.getByText("Borin"));
    expect(await screen.findByRole("menu", { name: "Borin" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.keyDown(screen.getByText("Borin"), { key: "Escape" });
    expect(rows().filter((r) => r.querySelector("[aria-selected=true]"))).toHaveLength(0);
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
    await pick("Aria", "Mark dead");
    await waitFor(() => expect(saved()).toMatchObject({ current: "b", round: 1 }));
    expect(saved().entries[0].dead).toBe(true);
    fireEvent.click(screen.getByLabelText("Next turn"));
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(saved()).toMatchObject({ current: "b", round: 2 }));
    await pick("Aria", "Mark alive");
    await waitFor(() => expect(saved().entries[0].dead).toBe(false));
  });

  it("removes a token but never the GM row", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    await pick("Aria", "Remove from initiative");
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual([GM_ENTRY]));
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
  });

  it("sees no turn-marker dots", async () => {
    obr.role = "PLAYER";
    obr.items = [token("p", { name: "Aria" })];
    scene([{ id: "p" }, { id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("Aria");
    expect(screen.queryByRole("img", { name: "Turn marker on" })).not.toBeInTheDocument();
  });

  it("sees the monsters under the GM row and whose turn it is", async () => {
    obr.role = "PLAYER";
    obr.items = [token("m1", { name: "Goblin" })];
    scene([{ id: GM_ENTRY }, { id: "m1", monster: true }], "m1", 1, COMBAT);
    render(<App />);
    expect(await screen.findByText("Goblin")).toBeInTheDocument();
    expect(rowOf("Goblin")).toHaveAttribute("aria-current", "step");
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
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { entries: [{ id: GM_ENTRY }], phase: "combat", current: GM_ENTRY, round: 2 } });
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
