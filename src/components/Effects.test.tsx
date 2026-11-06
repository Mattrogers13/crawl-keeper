import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { EFFECTS_KEY, LIGHTS_KEY, TRACKER_KEY } from "../constants";
import { parseEffects } from "../effects";
import { MINUTE } from "../lights";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, receiveBroadcast, setItems, token } from "../test/obrMock";
import { ADD_EFFECT_CHANNEL, askToAddEffect, takeHandoff } from "../addEffectHandoff";

const effects = () => parseEffects(obr.sceneMetadata[EFFECTS_KEY]).effects;
const tracker = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const pick = async (name: string, item: string) => {
  fireEvent.contextMenu(await screen.findByText(name));
  fireEvent.click(within(await screen.findByRole("menu", { name })).getByRole("menuitem", { name: item }));
};
const next = () => fireEvent.click(screen.getByLabelText("Next turn"));
const form = () => screen.getByRole("form", { name: "Add effect" });
// Aria, Borin, GM / Monsters, and Gob (a monster); Aria's turn in round 1.
const setup = (fx: object[] = [], current: string | null = "a", round = 1, extra: ReturnType<typeof token>[] = []) => {
  obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" }), token("g", { name: "Gob" }), ...extra];
  obr.sceneMetadata = {
    [TRACKER_KEY]: {
      entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }, { id: "g", monster: true }].map((e) => ({ roll: null, note: "", dead: false, ...e })),
      current,
      round,
    },
    [EFFECTS_KEY]: { effects: fx },
  };
  render(<App />);
};
const bless = { id: "e1", name: "Bless", kind: "rounds", holder: "a", rounds: 2, end: { round: 3, at: "a" } };
const hold = { id: "f1", name: "Hold Person", kind: "focus", holder: "a" };
const paralyzed = { id: "p1", name: "Paralyzed", icon: "paralyzed", kind: "until", holder: "g", endsWith: "f1" };

describe("Effects (GM)", () => {
  it("adds a rounds effect from the row menu; it counts down on ▶ and ends", async () => {
    setup();
    await pick("Aria", "Add effect…");
    fireEvent.change(within(form()).getByLabelText("Effect name"), { target: { value: "Bless" } });
    fireEvent.change(within(form()).getByRole("spinbutton"), { target: { value: "1" } });
    fireEvent.click(within(form()).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(effects()).toMatchObject([{ name: "Bless", holder: "a", rounds: 1, end: { round: 2, at: "a" } }]));
    expect(screen.queryByRole("form", { name: "Add effect" })).toBeNull();
    const chip = await screen.findByRole("button", { name: /^Bless · 1 of 1 rounds left/ });
    expect(chip).toHaveTextContent("Bless1");
    // Borin, GM, Gob (combat only: crawling, the GM turn covers him), then Aria in round 2.
    for (let i = 0; i < 2; i++) next();
    await waitFor(() => expect(tracker()).toMatchObject({ current: GM_ENTRY }));
    next();
    await waitFor(() => expect(tracker()).toMatchObject({ round: 2, current: "a" }));
    expect(await screen.findByText("ends now", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bless · ended/ })).toBeInTheDocument();
    next();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Bless/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Undo: Next turn" })).toBeInTheDocument();
  });

  it("a free-standing effect goes in the strip; one on a token not in initiative too, named", async () => {
    setup([{ id: "s1", name: "Webbed", kind: "until", holder: "x" }], "a", 1, [token("x", { name: "Statue" })]);
    fireEvent.click(await screen.findByRole("button", { name: "Add effect" }));
    expect(within(form()).queryByRole("radio", { name: "Focus" })).toBeNull();
    fireEvent.change(within(form()).getByLabelText("Effect name"), { target: { value: "Cloudkill" } });
    fireEvent.click(within(form()).getByRole("radio", { name: "Ongoing" }));
    fireEvent.click(within(form()).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(effects().map((e) => [e.name, e.holder])).toEqual([["Webbed", "x"], ["Cloudkill", null]]));
    const strip = await screen.findByRole("region", { name: "Effects" });
    expect(within(strip).getByRole("button", { name: /^Webbed on Statue/ })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: /^Cloudkill · until removed/ })).toBeInTheDocument();
  });

  it("a condition quick pick names the effect; one per selected row", async () => {
    setup();
    fireEvent.click(await screen.findByText("Aria"));
    fireEvent.click(screen.getByText("Borin"), { shiftKey: true });
    fireEvent.contextMenu(screen.getByText("Borin"));
    fireEvent.click(within(await screen.findByRole("menu", { name: "2 selected" })).getByRole("menuitem", { name: "Add effect to 2…" }));
    fireEvent.click(within(form()).getByRole("button", { name: "DIS" }));
    expect(within(form()).getByLabelText("Effect name")).toHaveValue("DIS");
    fireEvent.click(within(form()).getByRole("radio", { name: "Ongoing" }));
    fireEvent.click(within(form()).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(effects().map((e) => [e.name, e.icon, e.holder])).toEqual([["DIS", "dis", "a"], ["DIS", "dis", "b"]]));
  });

  it("a second focus asks first, then ends the old one and what ends with it", async () => {
    setup([hold, paralyzed]);
    await pick("Aria", "Add effect…");
    fireEvent.change(within(form()).getByLabelText("Effect name"), { target: { value: "Web" } });
    fireEvent.click(within(form()).getByRole("radio", { name: "Focus" }));
    fireEvent.click(within(form()).getByRole("button", { name: "Add" }));
    expect(within(form()).getByRole("alertdialog")).toHaveTextContent("Aria is focusing on Hold Person. End Hold Person, focus on Web?");
    expect(effects()).toHaveLength(2);
    fireEvent.click(within(form()).getByRole("button", { name: "End and focus" }));
    await waitFor(() => expect(effects().map((e) => e.name)).toEqual(["Web"]));
  });

  it("reminds of the focus check on the caster's turn; Lost ends it and what ends with it", async () => {
    setup([hold, paralyzed]);
    const reminders = await screen.findByRole("region", { name: "Reminders" });
    expect(reminders).toHaveTextContent("Aria: focus check, Hold Person (spellcasting check as if casting it)");
    fireEvent.click(within(reminders).getByRole("button", { name: "Lost" }));
    await waitFor(() => expect(effects()).toEqual([]));
    expect(screen.getByRole("button", { name: "Undo: Focus lost: Hold Person" })).toBeInTheDocument();
  });

  it("Nat 1 ends the focus and gives the critical-failure reminder", async () => {
    setup([hold]);
    fireEvent.click(within(await screen.findByRole("region", { name: "Reminders" })).getByRole("button", { name: "Nat 1" }));
    await waitFor(() => expect(effects()).toEqual([]));
    expect(vi.mocked(OBR.notification.show).mock.calls.at(-1)?.[0]).toMatch(/Aria: natural 1, a critical failure \(p\. 45\)/);
  });

  it("Focus check now from the row menu, off the caster's turn; Kept dismisses it", async () => {
    setup([hold], "b");
    await screen.findByText("Aria");
    expect(screen.queryByRole("region", { name: "Reminders" })).toBeNull();
    await pick("Aria", "Focus check now");
    const reminders = await screen.findByRole("region", { name: "Reminders" });
    fireEvent.click(within(reminders).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Reminders" })).toBeNull();
    expect(effects()).toHaveLength(1);
  });

  it("Mark dead ends the focus in the same step; one undo brings both back", async () => {
    setup([hold, paralyzed], "b");
    await pick("Aria", "Mark dead");
    await waitFor(() => expect(effects()).toEqual([]));
    expect(tracker().entries[0].dead).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Undo: Mark dead" }));
    await waitFor(() => expect(effects().map((e) => e.id)).toEqual(["f1", "p1"]));
    expect(tracker().entries[0].dead).toBe(false);
  });

  it("Reset rounds keeps each effect's rounds left", async () => {
    setup([bless], "b", 2);
    expect(await screen.findByRole("button", { name: /^Bless · 1 of 2 rounds left/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset rounds" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(tracker().round).toBe(0));
    expect(effects()[0].end).toEqual({ round: 1, at: "a" });
    expect(screen.getByRole("button", { name: /^Bless · 1 of 2 rounds left/ })).toBeInTheDocument();
  });

  it("a hidden effect's chip shows it: the struck-through eye and a dashed outline", async () => {
    setup([bless, { id: "h1", name: "Secret", kind: "until", holder: "a", hidden: true }]);
    const secret = await screen.findByRole("button", { name: /^Secret · until removed · hidden from players/ });
    expect(secret.querySelector("svg")).not.toBeNull();
    expect(secret).toHaveClass("border-dashed");
    const blessChip = screen.getByRole("button", { name: /^Bless ·/ });
    expect(blessChip.querySelector("svg")).toBeNull();
    expect(blessChip).not.toHaveClass("border-dashed");
  });

  it("the map's right-click Add effect…: the form opens for the token, panel closed or open, from Settings too", async () => {
    // Closed: the handoff waits for the tracker to mount.
    await askToAddEffect(["b"]);
    setup();
    expect(within(await screen.findByRole("form", { name: "Add effect" })).getByText("Borin", { selector: "span" })).toBeInTheDocument();
    fireEvent.click(within(form()).getByRole("button", { name: "Cancel" }));
    // Open, on Settings: the message brings the list back with the form.
    fireEvent.click(screen.getByLabelText("Settings"));
    await askToAddEffect(["a", "g"]);
    await receiveBroadcast(ADD_EFFECT_CHANNEL, { ids: ["a", "g"] }, obr.connectionId);
    expect(within(await screen.findByRole("form", { name: "Add effect" })).getByText("Aria, Gob", { selector: "span" })).toBeInTheDocument();
    expect(takeHandoff()).toBeNull();
  });

  it("a chip's menu sets rounds left and removes it", async () => {
    setup([bless]);
    fireEvent.click(await screen.findByRole("button", { name: /^Bless · 2 of 2/ }));
    const menu = screen.getByRole("menu", { name: "Bless" });
    fireEvent.change(within(menu).getByLabelText("Rounds left"), { target: { value: "5" } });
    fireEvent.click(within(menu).getByRole("button", { name: "Set" }));
    await waitFor(() => expect(effects()[0].end).toEqual({ round: 6, at: "a" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Bless · 5 of 2/ }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Bless" })).getByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(effects()).toEqual([]));
  });

  it("Time passes ends rounds effects (p. 82), lights and effects in one undo step", async () => {
    const now = Date.now();
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ id: "l1", kind: "torch", tokenId: "a", status: "lit", remainingMs: 60 * MINUTE, endsAt: now + 60 * MINUTE }] } };
    setup([bless, hold]);
    const field = await screen.findByLabelText("Time passes");
    fireEvent.change(field, { target: { value: "10m" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Time passes" })[0]);
    await waitFor(() => expect(effects().map((e) => e.name)).toEqual(["Hold Person"]));
    fireEvent.click(await screen.findByRole("button", { name: "Undo: Time passes 10m" }));
    await waitFor(() => expect(effects().map((e) => e.name).sort()).toEqual(["Bless", "Hold Person"]));
  });

  it("a token deleted from the map takes its effects, and what ends with its focus", async () => {
    setup([hold, paralyzed, { id: "c1", name: "Cloudkill", kind: "until" }]);
    await screen.findByText("Aria");
    await setItems(obr.items.filter((i) => i.id !== "a"));
    await waitFor(() => expect(effects().map((e) => e.name)).toEqual(["Cloudkill"]));
  });
});

describe("Effects (player)", () => {
  it("sees chips, the strip and reminders, read-only; nothing hidden, nothing on hidden tokens", async () => {
    obr.role = "PLAYER";
    setup([
      bless,
      hold,
      { id: "h1", name: "Secret", kind: "until", holder: "b", hidden: true },
      { id: "c1", name: "Cloudkill", kind: "until" },
    ]);
    await screen.findByText("Aria");
    await setItems(obr.items.map((i) => (i.id === "g" ? { ...i, visible: false } : i)));
    expect(await screen.findByRole("img", { name: /^Bless · 2 of 2/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Reminders" })).toHaveTextContent("Aria: focus check, Hold Person");
    expect(screen.queryByRole("button", { name: "Lost" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Effects" })).getByRole("img", { name: /^Cloudkill/ })).toBeInTheDocument();
    expect(screen.queryByText("Secret")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bless/ })).toBeNull();
  });
});
