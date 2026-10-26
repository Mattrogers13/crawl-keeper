import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { MARKER_KEY, SETTINGS_KEY, SKULL_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, setItems, setSceneReady, token, writeFromElsewhere, writeSceneFromElsewhere } from "../test/obrMock";

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
    expect(await screen.findByText("Not started")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "Combat" }));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "combat", current: null, round: 3 }));
    expect(saved().entries.map((e) => e.roll)).toEqual([null, null, null]);
    expect(screen.getByRole("button", { name: "Combat" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Next turn"));
    await waitFor(() => expect(screen.getByText("Round 4")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Crawl" }));
    await waitFor(() => expect(saved()).toMatchObject({ phase: "crawl", round: 4 }));
    expect(saved().entries.map((e) => e.roll)).toEqual([null, null, null]);
  });

  it("keeps the rolls on combat when the setting is off", async () => {
    obr.metadata = { [SETTINGS_KEY]: { clearRollsOnCombat: false } };
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a", roll: 15 }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Combat" }));
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
    expect(screen.getByText("Not started")).toBeInTheDocument();
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

  it("a failed save of a deleted current token leaves the ring where it was", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    await screen.findByText("Aria");
    obr.failWrites = true;
    await setItems([token("b", { name: "Borin" })]);
    await waitFor(() => expect(OBR.scene.setMetadata).toHaveBeenCalledTimes(1));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(obr.items.filter((i) => i.metadata[MARKER_KEY] !== undefined)).toEqual([]);
  });

  it("a token deleted, brought back and deleted again is dropped again", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    await screen.findByText("Aria");
    await setItems([token("b", { name: "Borin" })]);
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["b", GM_ENTRY]));
    // Ctrl+Z on the map, then Add Initiative again.
    await setItems([token("a", { name: "Aria" }), token("b", { name: "Borin" })]);
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), entries: [{ id: "a" }, ...saved().entries] } });
    await screen.findByText("Aria");
    await setItems([token("b", { name: "Borin" })]);
    await waitFor(() => expect(saved().entries.map((e) => e.id)).toEqual(["b", GM_ENTRY]));
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

  it("the GM rolls d20 + the monsters' modifier into the GM / Monsters roll", async () => {
    // A d20 that rolls 11 (restored at the end: later tests roll for real).
    const die = vi.spyOn(crypto, "getRandomValues").mockImplementation((buf) => {
      (buf as Uint32Array)[0] = Math.floor((10.5 / 20) * 2 ** 32);
      return buf;
    });
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    // The d20 left of the roll opens the modifier and Roll.
    fireEvent.click(await screen.findByLabelText("Roll initiative for GM / Monsters"));
    const mod = screen.getByLabelText("Monster DEX modifier");
    fireEvent.change(mod, { target: { value: "+2" } });
    fireEvent.blur(mod);
    await waitFor(() => expect(saved().gmMod).toBe(2));
    fireEvent.click(screen.getByLabelText("DEX modifier up"));
    await waitFor(() => expect(saved().gmMod).toBe(3));
    fireEvent.click(screen.getByRole("button", { name: "Roll d20+3" }));
    await waitFor(() => expect(saved().entries.find((e) => e.id === GM_ENTRY)?.roll).toBe(14));
    // The roll shows its equation under the row's name; Roll closed the box.
    expect(rowOf("GM / Monsters")).toHaveTextContent("d20 11 + 3");
    expect(screen.queryByLabelText("Monster DEX modifier")).not.toBeInTheDocument();
    // Not a number: the box puts the old value back.
    fireEvent.click(screen.getByLabelText("Roll initiative for GM / Monsters"));
    const saved3 = screen.getByLabelText("Monster DEX modifier");
    expect(saved3).toHaveValue("+3");
    fireEvent.change(saved3, { target: { value: "lots" } });
    fireEvent.blur(saved3);
    expect(saved3).toHaveValue("+3");
    die.mockRestore();
  });

  it("hotkeys: N next, B back, R the due roll; not while typing", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }], null, 0);
    render(<App />);
    await screen.findByText("Aria");
    fireEvent.keyDown(screen.getByLabelText("Note for Aria"), { key: "n" });
    expect(saved().current).toBeNull();
    fireEvent.keyDown(document.body, { key: "n" });
    await waitFor(() => expect(saved()).toMatchObject({ current: "a", round: 1 }));
    fireEvent.keyDown(document.body, { key: "N" });
    await waitFor(() => expect(saved().current).toBe(GM_ENTRY));
    fireEvent.keyDown(document.body, { key: "b" });
    await waitFor(() => expect(saved().current).toBe("a"));
    // Cmd-N is the browser's.
    fireEvent.keyDown(document.body, { key: "n", metaKey: true });
    expect(saved().current).toBe("a");
  });

  it("the d6 is always there: plain, ringed when due, the card lit when due on the GM's turn; R only rolls when due", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }], GM_ENTRY, 1, { crawl: { crawlRounds: 1 } });
    render(<App />);
    const card = await screen.findByRole("region", { name: "Encounter checks" });
    const roll = () => within(card).getByRole("button", { name: "Encounter check (d6)" });
    expect(roll()).not.toHaveClass("outline-obr-primary/60");
    expect(card).not.toHaveClass("ring-obr-primary");
    // Not due: R does nothing (a stray press can't replace a roll).
    fireEvent.keyDown(document.body, { key: "r" });
    expect(saved().crawl.last).toBeNull();
    // Due on a player's turn: outlined.
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), current: "a", crawl: { crawlRounds: 3 } } });
    expect(roll()).toHaveClass("outline-obr-primary/60");
    expect(card).not.toHaveClass("ring-obr-primary");
    expect(within(card).getByText("Check now")).toHaveClass("text-obr-primary");
    // Due on the GM's turn: the card lights up; R rolls it.
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), current: GM_ENTRY } });
    expect(card).toHaveClass("ring-obr-primary");
    fireEvent.keyDown(document.body, { key: "r" });
    await waitFor(() => expect(saved().crawl.last?.kind).toBe("check"));
    // In combat the card (and R) are gone.
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), phase: "combat", crawl: { crawlRounds: 6 } } });
    fireEvent.keyDown(document.body, { key: "r" });
    expect(saved().crawl.last).toBeNull();
  });

  it("Reset rounds and Remove monsters sit under the turn bar, above the list", async () => {
    obr.items = [token("m", { name: "Goblin" })];
    scene([{ id: GM_ENTRY }, { id: "m", monster: true }]);
    render(<App />);
    await screen.findByText("Goblin");
    const list = screen.getByLabelText("Monsters").closest(".overflow-y-auto")!;
    const next = screen.getByLabelText("Next turn");
    for (const link of [screen.getByText("Reset rounds"), screen.getByText("Remove monsters")]) {
      expect(list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(next.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("hotkeys wait while the row menu is open", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene([{ id: "a" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.contextMenu(await screen.findByText("Aria"));
    await screen.findByRole("menu");
    fireEvent.keyDown(document.body, { key: "n" });
    expect(saved().current).toBeNull();
  });

  it("the round count sits beside the title", async () => {
    scene([{ id: GM_ENTRY }], GM_ENTRY, 4);
    render(<App />);
    expect((await screen.findByText("Round 4")).closest("header")).toHaveTextContent("Crawl Keeper");
  });

  it("the modifier box shows what's stored, even when nothing changed", async () => {
    scene([{ id: GM_ENTRY }], null, 0, { gmMod: 3 });
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Roll initiative for GM / Monsters"));
    const mod = screen.getByLabelText("Monster DEX modifier");
    expect(mod).toHaveValue("+3");
    fireEvent.change(mod, { target: { value: "3" } });
    fireEvent.blur(mod);
    expect(screen.getByLabelText("Monster DEX modifier")).toHaveValue("+3");
  });

  it("Settings links to the how-to page and, in clock mode, holds the Crawling Clock rules", async () => {
    obr.metadata = { [SETTINGS_KEY]: { encounterMode: "standard" } };
    scene([{ id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Settings"));
    expect(await screen.findByRole("link", { name: /How to use Crawl Keeper/ })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Crawling Clock rules")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Crawling Clock" }));
    expect(await screen.findByText("Crawling Clock rules")).toBeInTheDocument();
  });

  it("a row's checkbox adds it to the selection or takes it out", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Select Aria"));
    fireEvent.click(screen.getByLabelText("Select Borin"));
    expect(screen.getByLabelText("Select Aria")).toBeChecked();
    expect(screen.getByLabelText("Select Borin")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Select Aria"));
    expect(screen.getByLabelText("Select Aria")).not.toBeChecked();
    expect(rowOf("Borin").querySelector("[aria-selected=true]")).not.toBeNull();
    // The GM row has none (it can't be selected).
    expect(screen.queryByLabelText("Select GM / Monsters")).not.toBeInTheDocument();
  });

  it("a typed GM roll drops the equation", async () => {
    scene([{ id: GM_ENTRY, roll: 14 }], null, 0, { gmMod: 2, gmDie: { die: 12, mod: 2 } });
    render(<App />);
    expect(await screen.findByText("d20 12 + 2")).toBeInTheDocument();
    const roll = screen.getByLabelText("Initiative for GM / Monsters");
    fireEvent.change(roll, { target: { value: "9" } });
    fireEvent.blur(roll);
    await waitFor(() => expect(saved().entries[0].roll).toBe(9));
    expect(screen.queryByText("d20 12 + 2")).not.toBeInTheDocument();
  });

  it("the monsters fold under the GM row, remembered in this browser; a monster's combat turn opens them", async () => {
    obr.items = [token("m1", { name: "Goblin" }), token("m2", { name: "Ogre" })];
    scene([{ id: GM_ENTRY }, { id: "m1", monster: true }, { id: "m2", monster: true }]);
    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByLabelText("Fold the monsters"));
    expect(screen.queryByText("Goblin")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show 2 monsters")).toHaveAttribute("aria-expanded", "false");
    unmount();
    render(<App />);
    expect(await screen.findByLabelText("Show 2 monsters")).toBeInTheDocument();
    // A monster's turn in combat: shown while it lasts.
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), phase: "combat", current: "m2", round: 1 } });
    expect(rowOf("Ogre")).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText("Fold the monsters")).toBeDisabled();
    expect(screen.getByText("Ogre")).toBeInTheDocument();
    // The turn passes on: folded again, as this viewer left it.
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), current: GM_ENTRY } });
    expect(screen.queryByText("Ogre")).not.toBeInTheDocument();
  });

  it("the round pill says the phase; in combat the crawl card folds to a line", async () => {
    scene([{ id: GM_ENTRY }], GM_ENTRY, 4, COMBAT);
    render(<App />);
    expect((await screen.findByText("Round 4")).closest("header")).toHaveTextContent("Combat·Round 4");
    expect(screen.getByText(/encounter checks paused/)).toBeInTheDocument();
  });

  describe("the crawl card", () => {
    it("standard: calls for the check on the GM turn of the 3rd crawl round; the roll saves", async () => {
      obr.items = [token("a", { name: "Aria" })];
      scene([{ id: "a" }, { id: GM_ENTRY }], GM_ENTRY, 3, { crawl: { crawlRounds: 3 } });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Encounter checks" });
      expect(within(card).getByText("Check now")).toBeInTheDocument();
      fireEvent.click(within(card).getByRole("button", { name: "Encounter check (d6)" }));
      await waitFor(() => expect(saved().crawl.last?.kind).toBe("check"));
      expect(saved().crawl.lastCheck).toBe(3);
      // The die shows the roll (its pips, and the number for screen readers), the outcome under it.
      expect(within(card).getByRole("button", { name: "Encounter check (d6)" })).toHaveTextContent(String(saved().crawl.last?.dice[0]));
      expect(within(card).getByLabelText("Last roll")).toHaveTextContent(/^(No encounter|Encounter!)$/);
      expect(within(card).getByText("3 rounds left")).toBeInTheDocument();
      fireEvent.click(within(card).getByText("Undo"));
      await waitFor(() => expect(saved().crawl).toMatchObject({ lastCheck: 0, last: null }));
    });

    it("standard: the danger level saves with the map; no darkness switch (darkness is Deadly, p. 84)", async () => {
      scene([{ id: GM_ENTRY }]);
      render(<App />);
      const card = await screen.findByRole("region", { name: "Encounter checks" });
      fireEvent.change(within(card).getByLabelText("Danger level"), { target: { value: "deadly" } });
      await waitFor(() => expect(saved().crawl.danger).toBe("deadly"));
      expect(within(card).queryByRole("button", { name: "Darkness" })).not.toBeInTheDocument();
    });

    it("clock: darkness saves with the map and makes the crawling die a d8", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      scene([{ id: GM_ENTRY }]);
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      fireEvent.click(within(card).getByRole("button", { name: "Darkness" }));
      await waitFor(() => expect(saved().crawl.dark).toBe(true));
      expect(within(card).getByRole("button", { name: "Roll d8" })).toBeInTheDocument();
    });

    it("after switching modes the die doesn't show the other mode's roll (or offer to undo it)", async () => {
      scene([{ id: GM_ENTRY }], GM_ENTRY, 1, {
        crawl: { crawlRounds: 1, lastCheck: 1, clock: 15, last: { kind: "clock", dice: [5], sides: 6, before: 20, after: 15, encounter: false }, undo: { clock: 20, lastCheck: 0 } },
      });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Encounter checks" });
      expect(within(card).getByLabelText("Last roll")).toHaveTextContent("Encounter check");
      expect(within(card).queryByText("Undo")).not.toBeInTheDocument();
      await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock" } });
      expect(within(await screen.findByRole("region", { name: "Crawling Clock" })).getByLabelText("Last roll")).toHaveTextContent("Clock 20 → 15");
    });

    it("clock: rolling takes the die off the clock; players see the clock unless hidden", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      scene([{ id: GM_ENTRY }], GM_ENTRY, 1, { crawl: { crawlRounds: 1 } });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      fireEvent.click(within(card).getByRole("button", { name: "Roll d6" }));
      await waitFor(() => expect(saved().crawl.last?.kind).toBe("clock"));
      expect(saved().crawl.clock).toBeLessThan(20);
      expect(within(card).getByRole("button", { name: "Roll d6" })).not.toHaveClass("bg-obr-primary");
      expect(within(card).getByLabelText("Last roll")).toHaveTextContent(/Clock 20 → \d+|Encounter!/);
    });

    it("clock: a fight (keyed or not) leaves the clock where it was", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      scene([{ id: GM_ENTRY }], null, 0, { phase: "combat", crawl: { clock: 9 } });
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "Crawl" }));
      await waitFor(() => expect(saved().phase).toBe("crawl"));
      expect(saved().crawl.clock).toBe(9);
    });

    it("standard counts the rounds to the check; the clock (a roll every round) has no such label", async () => {
      scene([{ id: GM_ENTRY }], GM_ENTRY, 1, { crawl: { crawlRounds: 1 } });
      const { unmount } = render(<App />);
      expect(within(await screen.findByRole("region", { name: "Encounter checks" })).getByText("2 rounds left")).toBeInTheDocument();
      unmount();
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      expect(within(card).queryByText(/Roll now|Rolled|left/)).not.toBeInTheDocument();
    });

    it("clock: an omen at 5 or lower is a reminder, not a roll", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      scene([{ id: GM_ENTRY }], null, 0, { crawl: { clock: 4 } });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      expect(within(card).getByText("Omen · 4")).toBeInTheDocument();
      expect(within(card).queryByText("Roll the encounter now")).not.toBeInTheDocument();
    });

    it("clock: Reset clock asks first; right-clicking the clock asks too", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      scene([{ id: GM_ENTRY }], null, 0, { crawl: { clock: 7 } });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      fireEvent.click(within(card).getByText("Reset clock"));
      fireEvent.click(within(card).getByText("Cancel"));
      expect(saved().crawl.clock).toBe(7);
      fireEvent.contextMenu(within(card).getByTitle("Right-click to reset the clock"));
      fireEvent.click(within(card).getByText("Reset"));
      // Full for either size (a 1d20 clock reads it as 20).
      await waitFor(() => expect(saved().crawl.clock).toBe(40));
      expect(within(card).getByRole("img", { name: "Clock 20 of 20" })).toBeInTheDocument();
    });

    it("sits in the top bar with the title, not in the list; not there in Settings", async () => {
      scene([{ id: GM_ENTRY }]);
      render(<App />);
      const card = await screen.findByRole("region", { name: "Encounter checks" });
      expect(card.closest("header")).toHaveTextContent("Crawl Keeper");
      expect(card.closest("li")).toBeNull();
      fireEvent.click(screen.getByLabelText("Settings"));
      await screen.findByText("Saved data");
      expect(screen.queryByRole("region", { name: "Encounter checks" })).not.toBeInTheDocument();
    });

    it("auto roll: ▶ onto the GM turn rolls the crawling die; off, it waits for the GM", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock", autoRoll: true } };
      obr.items = [token("a", { name: "Aria" })];
      scene([{ id: "a" }, { id: GM_ENTRY }], "a", 1, { crawl: { crawlRounds: 1 } });
      render(<App />);
      fireEvent.click(await screen.findByLabelText("Next turn"));
      await waitFor(() => expect(saved()).toMatchObject({ current: GM_ENTRY, crawl: { lastCheck: 1, last: { kind: "clock" } } }));
      expect(screen.getByLabelText("Last roll")).toHaveTextContent(/Clock 20 → \d+|Encounter!/);
    });

    it("without auto roll, ▶ onto the GM turn leaves the roll to the GM", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
      obr.items = [token("a", { name: "Aria" })];
      scene([{ id: "a" }, { id: GM_ENTRY }], "a", 1, { crawl: { crawlRounds: 1 } });
      render(<App />);
      fireEvent.click(await screen.findByLabelText("Next turn"));
      await waitFor(() => expect(saved().current).toBe(GM_ENTRY));
      expect(saved().crawl.last).toBeNull();
      expect(screen.getByRole("button", { name: "Roll d6" })).toBeInTheDocument();
    });

    it("2d20 clock: the d20 shows the front die, +20 while the second is full; rolls come off the 40", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock", clockDice: 2 } };
      scene([{ id: GM_ENTRY }], GM_ENTRY, 1, { crawl: { crawlRounds: 1, clock: 33 } });
      render(<App />);
      const card = await screen.findByRole("region", { name: "Crawling Clock" });
      const dial = within(card).getByRole("img", { name: "Clock 33 of 40" });
      expect(dial).toHaveTextContent("13");
      expect(dial).toHaveTextContent("+20");
      expect(card).toHaveTextContent("Crawling Clock · 2d20");
      fireEvent.click(within(card).getByRole("button", { name: "Roll d6" }));
      await waitFor(() => expect(saved().crawl.last?.before).toBe(33));
    });

    it("manual: the d6 and R roll a check; ▶ off the GM turn counts a due check made (rolled at the table)", async () => {
      obr.metadata = { [SETTINGS_KEY]: { encounterRolls: false, encounterMode: "clock", autoRoll: true } };
      obr.items = [token("a", { name: "Aria" })];
      scene([{ id: GM_ENTRY }, { id: "a" }], GM_ENTRY, 3, { crawl: { crawlRounds: 3 } });
      render(<App />);
      // The standard cadence (Unsafe: due in crawl round 3), even with the clock chosen.
      const card = await screen.findByRole("region", { name: "Encounter checks" });
      expect(card).toHaveTextContent("Check due: roll the d6, here or at the table");
      expect(within(card).queryByRole("button", { name: "Roll d6" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Next turn"));
      await waitFor(() => expect(saved()).toMatchObject({ current: "a", crawl: { lastCheck: 3, last: null } }));
      expect(card).toHaveTextContent("Manual rolls");
      // An extra check from the die, any time; R only when one is due.
      fireEvent.keyDown(document.body, { key: "r" });
      expect(saved().crawl.last).toBeNull();
      fireEvent.click(within(card).getByRole("button", { name: "Encounter check (d6)" }));
      await waitFor(() => expect(saved().crawl.last).toMatchObject({ kind: "check" }));
      expect(within(card).getByText("Undo")).toBeInTheDocument();
    });

    it("Settings: checks and clock off hides the method and auto roll", async () => {
      scene([{ id: GM_ENTRY }]);
      render(<App />);
      fireEvent.click(await screen.findByLabelText("Settings"));
      fireEvent.click(await screen.findByRole("radio", { name: "Crawling Clock" }));
      fireEvent.click(await screen.findByLabelText("2d20"));
      await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ encounterMode: "clock", clockDice: 2 }));
      fireEvent.click(screen.getByRole("switch", { name: /Encounter checks and the Crawling Clock/ }));
      await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ encounterRolls: false, encounterMode: "clock" }));
      expect(screen.queryByRole("radiogroup", { name: "Encounter checks" })).not.toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: /Roll automatically/ })).not.toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Show the rolls/ })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Show the danger level/ })).toBeInTheDocument();
    });

    it("no card in combat, and none for players", async () => {
      scene([{ id: GM_ENTRY }], null, 0, COMBAT);
      render(<App />);
      await screen.findByText("GM / Monsters");
      expect(screen.queryByRole("region", { name: "Encounter checks" })).not.toBeInTheDocument();
    });
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

  it("a token Torchlight lit shows a flame; in the dark the standard card says why it's Deadly", async () => {
    obr.items = [
      { ...token("a", { name: "Aria" }), metadata: { "io.github.mattrogers13.torchlight/token": { source: "lantern", saved: null } } },
      token("b", { name: "Borin" }),
    ];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], null, 0, { crawl: { danger: "deadly", dark: true, dangerBeforeDark: "unsafe" } });
    render(<App />);
    expect(await screen.findByRole("img", { name: "Lantern lit" })).toBeInTheDocument();
    expect(within(rowOf("Borin")).queryByRole("img", { name: /lit$/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Encounter checks" })).getByText("Darkness")).toBeInTheDocument();
  });

  it("a dead token wears a skull on the map until it's alive again or leaves the tracker", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }]);
    render(<App />);
    const skulls = () => obr.items.filter((i) => i.metadata[SKULL_KEY] !== undefined).map((i) => i.attachedTo);
    await pick("Aria", "Mark dead");
    await waitFor(() => expect(skulls()).toEqual(["a"]));
    await pick("Aria", "Mark alive");
    await waitFor(() => expect(skulls()).toEqual([]));
    await pick("Borin", "Mark dead");
    await waitFor(() => expect(skulls()).toEqual(["b"]));
    await pick("Borin", "Remove from initiative");
    await waitFor(() => expect(skulls()).toEqual([]));
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
    expect(screen.getByText("Not started")).toBeInTheDocument();
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

  it("sees the Crawling Clock unless the GM hides it; never the card", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
    scene([{ id: GM_ENTRY }], null, 0, { crawl: { clock: 13 } });
    render(<App />);
    expect(await screen.findByRole("region", { name: "Crawl status" })).toHaveTextContent("The clock is at 13");
    expect(screen.getByRole("img", { name: "Clock 13 of 20" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Crawling Clock" })).not.toBeInTheDocument();
    await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock", hideClock: true } });
    expect(screen.queryByRole("region", { name: "Crawl status" })).not.toBeInTheDocument();
    await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock", clockDice: 2 } });
    expect(screen.getByRole("img", { name: "Clock 13 of 40" })).toBeInTheDocument();
    // Manual: the GM's clock isn't running, so players don't see it.
    await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock", encounterRolls: false } });
    expect(screen.queryByRole("region", { name: "Crawl status" })).not.toBeInTheDocument();
  });

  it("sees the danger level only when the GM shows it", async () => {
    obr.role = "PLAYER";
    scene([{ id: GM_ENTRY }], null, 0, { crawl: { danger: "risky" } });
    render(<App />);
    await screen.findByText("Crawl");
    expect(screen.queryByRole("region", { name: "Crawl status" })).not.toBeInTheDocument();
    await writeFromElsewhere({ [SETTINGS_KEY]: { showDanger: true } });
    expect(screen.getByRole("region", { name: "Crawl status" })).toHaveTextContent("risky");
  });

  it("sees 'Your turn' on the turn of a token they put on the map, not on anyone else's", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin", createdUserId: "someone-else" })];
    scene([{ id: "a" }, { id: "b" }, { id: GM_ENTRY }], "a", 1);
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Your turn, Aria");
    await writeSceneFromElsewhere({ [TRACKER_KEY]: { ...saved(), current: "b" } });
    expect(screen.queryByText("Your turn")).not.toBeInTheDocument();
  });

  it("sees the last roll only when the GM shows the rolls", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [SETTINGS_KEY]: { encounterMode: "clock" } };
    scene([{ id: GM_ENTRY }], GM_ENTRY, 1, {
      crawl: { crawlRounds: 1, lastCheck: 1, clock: 9, last: { kind: "clock", dice: [6, 5], sides: 6, before: 20, after: 9, encounter: false } },
    });
    render(<App />);
    expect(await screen.findByRole("region", { name: "Crawl status" })).toHaveTextContent("The clock is at 9");
    expect(screen.queryByLabelText("Last roll")).not.toBeInTheDocument();
    await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock", showRolls: true } });
    expect(screen.getByLabelText("Last roll")).toHaveTextContent("11d6Clock 20 → 9");
    // Hidden clock, rolls shown: the card still shows the roll.
    await writeFromElsewhere({ [SETTINGS_KEY]: { encounterMode: "clock", showRolls: true, hideClock: true } });
    expect(screen.getByRole("region", { name: "Crawl status" })).not.toHaveTextContent("The clock is at");
    expect(screen.getByLabelText("Last roll")).toBeInTheDocument();
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
    expect(screen.getByText("Crawl").closest("header")).toBeInTheDocument();
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
