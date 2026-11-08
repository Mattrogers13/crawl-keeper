import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { EFFECTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { dicePlusActive } from "../diceRoller";
import { fakeDicePlus, type Answer } from "../test/fakeDicePlus";
import { obr, token } from "../test/obrMock";
import { GM_ENTRY, parseTracker } from "../tracker";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
// Aria and the GM row, crawling; round 3 of standard checks (Unsafe: due).
const setup = (answers: Answer[], settings: object = {}, current: string | null = GM_ENTRY) => {
  const requests = fakeDicePlus(answers);
  obr.metadata = { [SETTINGS_KEY]: settings };
  obr.items = [token("a", { name: "Aria" })];
  obr.sceneMetadata = {
    [TRACKER_KEY]: {
      entries: [{ id: "a", roll: 12 }, { id: GM_ENTRY, roll: 5 }].map((e) => ({ note: "", dead: false, ...e })),
      current,
      round: 3,
      crawl: { crawlRounds: 3 },
    },
  };
  render(<App />);
  return requests;
};
const ready = () => waitFor(() => expect(dicePlusActive()).toBe(true));

describe("rolling with Dice+", () => {
  it("the card's die rolls through Dice+ (to the GM only by default); a second click while it rolls does nothing", async () => {
    const requests = setup([[1]]);
    await ready();
    const die = await screen.findByRole("button", { name: "Encounter check (d6)" });
    await act(async () => {
      fireEvent.click(die);
      fireEvent.click(die);
    });
    await waitFor(() => expect(saved().crawl.last).toMatchObject({ kind: "check", dice: [1], encounter: true }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ rollTarget: "gm_only", diceNotation: "1d6 # Encounter check" });
  });

  it("players set to see the rolls: everyone sees the dice", async () => {
    const requests = setup([[4]], { showRolls: true });
    await ready();
    fireEvent.click(await screen.findByRole("button", { name: "Encounter check (d6)" }));
    await waitFor(() => expect(saved().crawl.last).toMatchObject({ dice: [4] }));
    expect(requests[0]).toMatchObject({ rollTarget: "everyone" });
  });

  it("auto roll on ▶: the turn moves at once, the Dice+ roll lands as its own undo step", async () => {
    setup([[3]], { autoRoll: true }, "a");
    await ready();
    fireEvent.click(await screen.findByLabelText("Next turn"));
    await waitFor(() => expect(saved().crawl.last).toMatchObject({ dice: [3] }));
    expect(saved().current).toBe(GM_ENTRY);
    expect(screen.getByRole("button", { name: "Undo: Encounter check" })).toBeInTheDocument();
  });

  it("the monsters' initiative d20 rolls for everyone to see", async () => {
    const requests = setup([[17]], {}, null);
    await ready();
    fireEvent.click(await screen.findByLabelText("Roll initiative for GM / Monsters"));
    fireEvent.click(screen.getByRole("button", { name: /^Roll d20/ }));
    await waitFor(() => expect(saved().entries.find((e) => e.id === GM_ENTRY)?.roll).toBe(17));
    expect(requests[0]).toMatchObject({ rollTarget: "everyone", diceNotation: "1d20 # Monsters' initiative" });
  });

  it("death rolls go to everyone, or only the GM when the death timer is kept from players", async () => {
    const requests = setup([[7]], { showDeath: false }, "a");
    obr.sceneMetadata[EFFECTS_KEY] = { effects: [{ id: "d1", name: "Dying", icon: "dying", kind: "rounds", holder: "a", rounds: 3, end: { round: 5, at: "a" } }] };
    await ready();
    // Aria's turn: the death prompt opens by itself.
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Death roll first" })).getByRole("button", { name: "Roll d20" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ rollTarget: "gm_only", diceNotation: "1d20 # Death d20" });
  });

  it("Settings says whether Dice+ answered; off, rolls stay here", async () => {
    const requests = setup([[2]]);
    fireEvent.click(await screen.findByLabelText("Settings"));
    expect(await screen.findByText("Dice+ found: rolls go to Dice+.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /Roll with Dice\+/ }));
    await waitFor(() => expect(obr.metadata[SETTINGS_KEY]).toMatchObject({ dicePlus: false }));
    await waitFor(() => expect(dicePlusActive()).toBe(false));
    fireEvent.click(screen.getByLabelText("Back to tracker"));
    fireEvent.click(await screen.findByRole("button", { name: "Encounter check (d6)" }));
    await waitFor(() => expect(saved().crawl.last).not.toBeNull());
    expect(requests).toHaveLength(0);
    expect(within(document.body).queryByText(/Dice\+ found/)).toBeNull();
  });
});
