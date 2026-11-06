import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { EFFECTS_KEY, TRACKER_KEY } from "../constants";
import { DYING_CHANNEL } from "../deathNotices";
import { parseEffects } from "../effects";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, token } from "../test/obrMock";

// The crypto spies (a chosen die) stay in their test.
afterEach(() => vi.restoreAllMocks());
// The next crypto rolls all give this 32-bit value (0: a 1; 0xffffffff: the top face).
const die = (value: number) =>
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((a: Uint32Array) => {
    a.fill(value);
    return a;
  }) as typeof crypto.getRandomValues);

const effects = () => parseEffects(obr.sceneMetadata[EFFECTS_KEY]).effects;
const tracker = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const sent = () => vi.mocked(OBR.broadcast.sendMessage).mock.calls.filter((c) => c[0] === DYING_CHANNEL).map((c) => c[1]);
const rowName = async (name: string) => (await screen.findAllByText(name)).find((el) => el.closest("li"))!;
const menu = async (name: string) => {
  fireEvent.contextMenu(await rowName(name));
  return within(await screen.findByRole("menu", { name }));
};
// Aria, Borin, GM / Monsters, Gob (a monster).
const setup = (fx: object[] = [], current: string | null = "a", round = 1) => {
  obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" }), token("g", { name: "Gob" })];
  obr.sceneMetadata = {
    [TRACKER_KEY]: {
      entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }, { id: "g", monster: true }].map((e) => ({ roll: null, note: "", dead: false, ...e })),
      current,
      round,
      phase: "combat",
    },
    [EFFECTS_KEY]: { effects: fx },
  };
  render(<App />);
};
// Aria rolled 3 on her turn in round 1: d20s in rounds 2 and 3, out at the start of round 4.
const dying = { id: "d1", name: "Dying", icon: "dying", kind: "rounds", holder: "a", rounds: 3, end: { round: 4, at: "a" } };

describe("the death timer (GM)", () => {
  it("row menu → Dying…: player rows only; the sheet sets the timer, one undo step, everyone told", async () => {
    setup([], "b");
    expect((await menu("Gob")).queryByRole("menuitem", { name: "Dying…" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click((await menu("Aria")).getByRole("menuitem", { name: "Dying…" }));
    const sheet = screen.getByRole("form", { name: "Dying" });
    fireEvent.click(within(sheet).getByRole("button", { name: "+2" }));
    expect(within(sheet).getByRole("button", { name: "Roll 1d4 + 2 CON" })).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText("Rounds"), { target: { value: "3" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Set" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Dying", icon: "dying", holder: "a", rounds: 3 }]));
    expect(screen.queryByRole("form", { name: "Dying" })).toBeNull();
    expect(sent()).toEqual([{ event: "started", name: "Aria", rounds: 3, d4: null, con: null }]);
    expect(screen.getByRole("button", { name: "Undo: Dying: Aria" })).toBeInTheDocument();
    expect((await menu("Aria")).queryByRole("menuitem", { name: "Dying…" })).toBeNull();
  });

  it("the sheet's roll: 1d4 + CON, at least 1", async () => {
    die(0); // a 1
    setup([], "b");
    fireEvent.click((await menu("Aria")).getByRole("menuitem", { name: "Dying…" }));
    const sheet = screen.getByRole("form", { name: "Dying" });
    fireEvent.click(within(sheet).getByRole("button", { name: "−3" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Roll 1d4 − 3 CON" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Dying", rounds: 1 }]));
    expect(sent()).toEqual([{ event: "started", name: "Aria", rounds: 1, d4: 1, con: -3 }]);
  });

  it("on their later turns: Roll d20 (a 20 rises), Nat 20, Stabilized, Healed", async () => {
    die(0xffffffff); // a 20
    setup([dying], "a", 2);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("Aria is dying · 2 rounds left");
    fireEvent.click(within(line).getByRole("button", { name: "Roll d20" }));
    await waitFor(() => expect(effects()).toEqual([]));
    expect(sent()).toEqual([
      { event: "rolled", name: "Aria", value: 20 },
      { event: "rises", name: "Aria" },
    ]);
  });

  it("the rolling turn offers no d20; Stabilized leaves them unconscious", async () => {
    setup([dying], "a", 1);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("timer rolled this turn");
    expect(within(line).queryByRole("button", { name: "Roll d20" })).toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: "Stabilized" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Unconscious", icon: "unconscious", kind: "until", holder: "a" }]));
    expect(sent()).toEqual([{ event: "stabilized", name: "Aria" }]);
  });

  it("healed off their turn from the effect line's menu", async () => {
    setup([dying], "b", 2);
    fireEvent.click(await screen.findByRole("button", { name: /^Dying · 2 of 3 rounds left/ }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Dying" })).getByRole("menuitem", { name: "Healed (no longer dying)" }));
    await waitFor(() => expect(effects()).toEqual([]));
    expect(sent()).toEqual([{ event: "healed", name: "Aria" }]);
  });

  it("timer ran out: Mark dead, one undo step; Time passes leaves a dying character alone", async () => {
    setup([dying], "a", 4);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("Aria's death timer ran out");
    expect(screen.queryByText(/Dying on Aria ends now/)).toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: "Mark dead" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(true));
    expect(effects()).toEqual([]);
    expect(sent()).toEqual([{ event: "died", name: "Aria" }]);
    fireEvent.click(screen.getByRole("button", { name: "Undo: Mark dead" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(false));
    expect(effects()).toMatchObject([{ id: "d1" }]);
  });
});

describe("the death timer (player)", () => {
  it("sees the line, no buttons", async () => {
    obr.role = "PLAYER";
    setup([dying], "a", 2);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("Aria is dying · 2 rounds left");
    expect(within(line).queryAllByRole("button")).toEqual([]);
  });
});
