import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { EFFECTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
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
const destinations = () => vi.mocked(OBR.broadcast.sendMessage).mock.calls.filter((c) => c[0] === DYING_CHANNEL).map((c) => c[2]?.destination);
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
  it("row menu → Dying… off their turn: marked dying now (one undo step, everyone told), the timer waits for their turn", async () => {
    setup([], "b");
    expect((await menu("Gob")).queryByRole("menuitem", { name: "Dying…" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click((await menu("Aria")).getByRole("menuitem", { name: "Dying…" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Dying", icon: "dying", holder: "a", kind: "until" }]));
    expect(screen.queryByRole("form", { name: "Dying" })).toBeNull();
    expect(sent()).toEqual([{ event: "down", name: "Aria" }]);
    expect(screen.getByRole("button", { name: "Undo: Dying: Aria" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Dying · the timer is rolled on their turn/ })).toBeInTheDocument();
    expect((await menu("Aria")).queryByRole("menuitem", { name: "Dying…" })).toBeNull();
  });

  it("their turn: ▶ opens the timer sheet; the roll sets the timer from this turn (one undo step, everyone told) and the turn moves on", async () => {
    setup([{ id: "d1", name: "Dying", icon: "dying", kind: "until", holder: "a" }], "a", 11);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("Aria is dying · rolls the death timer this turn");
    expect(within(line).getByRole("button", { name: "Roll the timer" })).toBeInTheDocument();
    expect(within(line).queryByRole("button", { name: "Failed" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Next turn"));
    const sheet = await screen.findByRole("form", { name: "Dying" });
    expect(tracker().current).toBe("a");
    fireEvent.change(within(sheet).getByLabelText("Rounds"), { target: { value: "7" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Set" }));
    // Rolled on Aria's turn in round 11: the last chance is her turn in round 18 (p. 89).
    await waitFor(() => expect(effects()).toMatchObject([{ id: "d1", kind: "rounds", rounds: 7, end: { round: 18, at: "a" } }]));
    await waitFor(() => expect(tracker().current).toBe("b"));
    expect(sent()).toEqual([{ event: "started", name: "Aria", rounds: 7, d4: null, con: null }]);
  });

  it("their turn: Skip for now on the timer sheet moves on with no timer; ▶ asks again on their next turn", async () => {
    setup([{ id: "d1", name: "Dying", icon: "dying", kind: "until", holder: "a" }], "a", 11);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("form", { name: "Dying" })).getByRole("button", { name: "Skip for now →" }));
    await waitFor(() => expect(tracker().current).toBe("b"));
    expect(effects()).toMatchObject([{ id: "d1", kind: "until" }]);
    for (const at of [GM_ENTRY, "g", "a"]) {
      fireEvent.click(screen.getByLabelText("Next turn"));
      await waitFor(() => expect(tracker().current).toBe(at));
    }
    fireEvent.click(screen.getByLabelText("Next turn"));
    expect(await screen.findByRole("form", { name: "Dying" })).toBeInTheDocument();
  });

  it("dropped on their own turn: Dying… opens the sheet at once; the sheet's roll: 1d4 + CON, at least 1", async () => {
    die(0); // a 1
    setup([], "a");
    fireEvent.click((await menu("Aria")).getByRole("menuitem", { name: "Dying…" }));
    const sheet = screen.getByRole("form", { name: "Dying" });
    fireEvent.click(within(sheet).getByRole("button", { name: "+2" }));
    expect(within(sheet).getByRole("button", { name: "Roll 1d4 + 2 CON" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "−3" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Roll 1d4 − 3 CON" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Dying", kind: "rounds", rounds: 1 }]));
    expect(sent()).toEqual([{ event: "started", name: "Aria", rounds: 1, d4: 1, con: -3 }]);
    // From the menu the turn stays.
    expect(tracker().current).toBe("a");
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

  it("the last turn (timer out) is a last chance: Failed and they die, one undo step", async () => {
    setup([dying], "a", 4);
    const line = await screen.findByRole("group", { name: "Aria dying" });
    expect(line).toHaveTextContent("Aria is dying · the timer runs out: last chance");
    expect(screen.queryByText(/Dying on Aria ends now/)).toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: "Failed" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(true));
    expect(effects()).toEqual([]);
    expect(sent()).toEqual([{ event: "died", name: "Aria" }]);
    fireEvent.click(screen.getByRole("button", { name: "Undo: Dead: Aria" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(false));
    expect(effects()).toMatchObject([{ id: "d1" }]);
  });
});

describe("▶ with a death roll owed", () => {
  it("asks first: the prompt, the turn stays; Failed (the big button) moves it on", async () => {
    setup([dying], "a", 2);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    const prompt = await screen.findByRole("dialog", { name: "Death roll first" });
    expect(tracker()).toMatchObject({ round: 2, current: "a" });
    expect(prompt).toHaveTextContent("Aria is dying");
    // By how often each happens: Failed, Stabilized, Healed, Nat 20, Roll d20; then Skip and Mark dead.
    expect(within(prompt).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Close",
      "Failed · still dying",
      "Stabilized",
      "Healed",
      "Nat 20",
      "Roll d20",
      "Skip for now →",
      "Mark dead",
    ]);
    fireEvent.click(within(prompt).getByRole("button", { name: "Failed · still dying" }));
    await waitFor(() => expect(tracker().current).toBe("b"));
    expect(screen.queryByRole("dialog", { name: "Death roll first" })).toBeNull();
    expect(effects()).toMatchObject([{ id: "d1" }]);
  });

  it("the last chance from the prompt: Failed · Aria dies marks them dead, the turn passes on (once); Undo brings them back", async () => {
    setup([dying], "a", 4);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    const prompt = await screen.findByRole("dialog", { name: "Death roll first" });
    expect(prompt).toHaveTextContent("Aria: last chance");
    expect(within(prompt).queryByRole("button", { name: "Mark dead" })).toBeNull();
    fireEvent.click(within(prompt).getByRole("button", { name: "Failed · Aria dies" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(true));
    expect(tracker()).toMatchObject({ round: 4, current: "b" });
    fireEvent.click(screen.getByRole("button", { name: "Undo: Dead: Aria" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(false));
    expect(effects()).toMatchObject([{ id: "d1" }]);
  });

  it("Mark dead from the prompt (before the timer is out)", async () => {
    setup([dying], "a", 2);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Mark dead" }));
    await waitFor(() => expect(tracker().entries[0].dead).toBe(true));
    expect(tracker()).toMatchObject({ round: 2, current: "b" });
  });

  it("Skip for now on the last chance: the turn moves on, they stay dying, asked again on their next turn (still a last chance)", async () => {
    setup([dying], "a", 4);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Skip for now →" }));
    await waitFor(() => expect(tracker().current).toBe("b"));
    expect(tracker().entries[0].dead).toBe(false);
    // Still dying: the timer's end moves to Aria's next turn (one undo step).
    await waitFor(() => expect(effects()).toMatchObject([{ id: "d1", end: { round: 5, at: "a" } }]));
    expect(sent()).toEqual([]);
    // Borin, GM, Gob, then Aria's turn again: ▶ asks again.
    for (const at of [GM_ENTRY, "g", "a"]) {
      fireEvent.click(screen.getByLabelText("Next turn"));
      await waitFor(() => expect(tracker().current).toBe(at));
    }
    fireEvent.click(screen.getByLabelText("Next turn"));
    expect(await screen.findByRole("dialog", { name: "Death roll first" })).toHaveTextContent("Aria: last chance");
    expect(tracker().current).toBe("a");
  });

  it("Skip for now on the last chance: Undo takes back the turn, then the skip", async () => {
    setup([dying], "a", 4);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Skip for now →" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Next turn" }));
    await waitFor(() => expect(tracker().current).toBe("a"));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Skip: Aria's last chance" }));
    await waitFor(() => expect(effects()).toMatchObject([{ id: "d1", end: { round: 4, at: "a" } }]));
  });

  it("Skip for now before the timer is out: nothing written", async () => {
    setup([dying], "a", 2);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Skip for now →" }));
    await waitFor(() => expect(tracker().current).toBe("b"));
    expect(effects()).toEqual([dying].map((d) => expect.objectContaining({ id: d.id, end: d.end })));
    expect(screen.getByRole("button", { name: "Undo: Next turn" })).toBeInTheDocument();
  });

  it("✕ by accident: the turn stays, ▶ opens the prompt again, and the notices line keeps its buttons", async () => {
    setup([dying], "a", 2);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Death roll first" })).toBeNull();
    expect(tracker().current).toBe("a");
    expect(within(screen.getByRole("group", { name: "Aria dying" })).getByRole("button", { name: "Failed" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Next turn"));
    expect(await screen.findByRole("dialog", { name: "Death roll first" })).toBeInTheDocument();
  });

  it("no death roll owed (the turn the timer was rolled): ▶ just moves on", async () => {
    setup([dying], "a", 1);
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(tracker().current).toBe("b"));
  });
});

describe("the death timer kept from players (Settings)", () => {
  it("players see no Dying line; the GM sees it marked hidden; the events go to the GM's client only", async () => {
    obr.metadata = { [SETTINGS_KEY]: { showDeath: false } };
    setup([dying], "a", 2);
    const line = await screen.findByRole("button", { name: /^Dying · .*hidden from players/ });
    expect(line).toHaveClass("border-dashed");
    fireEvent.click(within(await screen.findByRole("group", { name: "Aria dying" })).getByRole("button", { name: "Healed" }));
    await waitFor(() => expect(destinations()).toEqual(["LOCAL"]));
  });

  it("the player's panel shows nothing of it", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [SETTINGS_KEY]: { showDeath: false } };
    setup([dying], "a", 2);
    await rowName("Aria");
    expect(screen.queryByRole("group", { name: "Aria dying" })).toBeNull();
    expect(screen.queryByText("Dying")).toBeNull();
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
