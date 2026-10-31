import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY } from "../tracker";
import { MINUTE, parseLights, remaining } from "../lights";
import { obr, setItems, token } from "../test/obrMock";

const T0 = Date.parse("2026-10-31T20:00:00Z");
const saved = () => parseLights(obr.metadata[LIGHTS_KEY]);
const left = (i: number) => remaining(saved().lights[i], Date.now());
const scene = (ids: string[]) => {
  obr.sceneMetadata = { [TRACKER_KEY]: { entries: [...ids, GM_ENTRY].map((id) => ({ id, roll: null, note: "", dead: false })), current: null, round: 0 } };
};
const pick = async (name: string, item: string) => {
  fireEvent.contextMenu(await screen.findByText(name));
  fireEvent.click(within(await screen.findByRole("menu", { name })).getByRole("menuitem", { name: item }));
};
const menuItems = async (name: string) => {
  fireEvent.contextMenu(await screen.findByText(name));
  const items = within(await screen.findByRole("menu", { name })).getAllByRole("menuitem").map((b) => b.textContent);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  return items;
};
const card = (name: RegExp | string) => screen.getByRole("article", { name });
const lit = (id: string, tokenId: string, kind = "torch", ms = 60 * MINUTE) => ({
  id,
  kind,
  tokenId,
  carrier: "Old name",
  note: "",
  status: "lit",
  remainingMs: ms,
  endsAt: T0 + ms,
  spentAt: null,
});

// Only Date is fake: countdowns hold still, and Testing Library's waits
// still run on real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("Give light (row menu)", () => {
  it("gives a token a torch; with one lit, the menu offers the swap instead", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene(["a"]);
    render(<App />);
    await pick("Aria", "Give torch");
    await waitFor(() => expect(saved().lights).toHaveLength(1));
    expect(saved().lights[0]).toMatchObject({ kind: "torch", tokenId: "a", carrier: "Aria", status: "lit", endsAt: T0 + 60 * MINUTE });
    await waitFor(async () =>
      expect(await menuItems("Aria")).toEqual(expect.arrayContaining(["Put out the torch, light the lantern", "Put out the torch, light the Light spell"])),
    );
    expect(await menuItems("Aria")).not.toContain("Give torch");
    await pick("Aria", "Put out the torch, light the lantern");
    // The torch is used once lit, so it's gone.
    await waitFor(() => expect(saved().lights.map((l) => [l.kind, l.status])).toEqual([["lantern", "lit"]]));
    expect(screen.getByRole("button", { name: "Undo: Swap torch for lantern" })).toBeInTheDocument();
  });

  it("a lantern that's out: light it with its oil, or refill and light", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...lit("l1", "a", "lantern", 30 * MINUTE), status: "out", endsAt: null }] } };
    scene(["a"]);
    render(<App />);
    const items = await menuItems("Aria");
    expect(items).toEqual(expect.arrayContaining(["Give torch", "Light the lantern (30:00 left)", "Refill and light the lantern"]));
    expect(items).not.toContain("Give lantern");
    await pick("Aria", "Give torch");
    await waitFor(() => expect(saved().lights.map((l) => [l.kind, l.status])).toEqual([["lantern", "out"], ["torch", "lit"]]));
    await waitFor(async () => expect(await menuItems("Aria")).toContain("Put out the torch, light the lantern (30:00 left)"));
    await pick("Aria", "Put out the torch, light the lantern (30:00 left)");
    await waitFor(() => expect(saved().lights.map((l) => [l.id, l.status])).toEqual([["l1", "lit"]]));
    expect(left(0)).toBe(30 * MINUTE);
  });

  it("isn't offered for the GM row or several rows at once", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    scene(["a", "b"]);
    render(<App />);
    fireEvent.click(await screen.findByLabelText("Select Aria"));
    fireEvent.click(screen.getByLabelText("Select Borin"));
    fireEvent.contextMenu(screen.getByText("Aria"));
    expect(within(await screen.findByRole("menu")).queryByRole("menuitem", { name: /Give/ })).not.toBeInTheDocument();
  });
});

describe("the Light Tracker", () => {
  const open = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Light Tracker" }));
    await screen.findByRole("heading", { name: "Light Tracker" });
    await screen.findByRole("button", { name: "Put lights out" });
  };

  it("opens from the header's flame, says how to start a light, and goes back", async () => {
    scene([]);
    render(<App />);
    await open();
    expect(screen.getByText(/No lights yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Put lights out" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Back to tracker"));
    expect(await screen.findByRole("heading", { name: "Crawl Keeper" })).toBeInTheDocument();
  });

  it("a card per light with the token's current name (or the saved one off the map), its time, and the party's light", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a"), lit("l2", "gone", "lantern", 30 * MINUTE)] } };
    scene(["a"]);
    render(<App />);
    await open();
    expect(card("Torch · Aria")).toHaveTextContent("1:00:00");
    expect(card("Lantern · Old name")).toHaveTextContent("30:00");
    expect(screen.getByRole("status")).toHaveTextContent("Party has light · 2 shining");
  });

  it("Put out, Light and Remove, each an undo step", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "lantern")] } };
    scene(["a"]);
    render(<App />);
    await open();
    vi.setSystemTime(T0 + 10 * MINUTE);
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Put out" }));
    await waitFor(() => expect(saved().lights[0]).toMatchObject({ status: "out", remainingMs: 45 * MINUTE }));
    expect(screen.getByRole("status")).toHaveTextContent(/total darkness/);
    vi.setSystemTime(T0 + 30 * MINUTE);
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Light" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("lit"));
    expect(left(0)).toBe(45 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Undo: Light lantern" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("out"));
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(saved().lights).toHaveLength(0));
    expect(screen.getByRole("button", { name: "Undo: Remove lantern" })).toBeInTheDocument();
  });

  it("Time passes reads the text field; nonsense is explained, not saved", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    await open();
    const field = screen.getByLabelText("Time passes");
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Time passes" }));
    expect(screen.getByText(/Try 10m, 1h/)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "10m" } });
    fireEvent.click(screen.getByRole("button", { name: "Time passes" }));
    await waitFor(() => expect(left(0)).toBe(50 * MINUTE));
    expect(screen.getByText("10m passed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo: Time passes 10m" })).toBeInTheDocument();
  });

  it("the header's flame opens it with no lights yet", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene(["a"]);
    render(<App />);
    await screen.findByText("Aria");
    expect(screen.queryByRole("region", { name: "Lights" })).not.toBeInTheDocument();
    // Dim, but there.
    expect(screen.getByRole("button", { name: "Light Tracker" })).toHaveAttribute("title", "Light Tracker (no lights yet)");
    fireEvent.click(screen.getByRole("button", { name: "Light Tracker" }));
    expect(await screen.findByText(/No lights yet/)).toBeInTheDocument();
  });

  it("Put lights out spends the torches, offering Undo in a toast", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    obr.metadata = { [LIGHTS_KEY]: { lightingRule: "separate", lights: [lit("l1", "a"), lit("l2", "b", "lightSpell")] } };
    scene(["a", "b"]);
    render(<App />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Put lights out" }));
    await waitFor(() => expect(saved().lights.map((l) => l.status)).toEqual(["spent", "spent"]));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(saved().lights.map((l) => l.status)).toEqual(["lit", "lit"]));
  });

  it("Remove all lights asks first, then offers Undo", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a"), lit("l2", "b", "lightSpell")] } };
    scene(["a", "b"]);
    render(<App />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Remove all lights" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove all 2 lights?" })).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(saved().lights).toHaveLength(0));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(saved().lights).toHaveLength(2));
  });

  it("clicking the time corrects it", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    await open();
    fireEvent.click(within(card("Torch · Aria")).getByRole("button", { name: /Time left 1:00:00/ }));
    const input = screen.getByLabelText("Time left");
    fireEvent.change(input, { target: { value: "31:00" } });
    fireEvent.submit(input);
    await waitFor(() => expect(left(0)).toBe(31 * MINUTE));
  });

  it("a lantern put out keeps its oil to the quarter hour, lights again, and takes oil", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "lantern", 38 * MINUTE)] } };
    scene(["a"]);
    render(<App />);
    await open();
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Put out" }));
    await waitFor(() => expect(saved().lights[0]).toMatchObject({ status: "out", remainingMs: 30 * MINUTE }));
    expect(card("Lantern · Aria")).toHaveTextContent("out · oil kept");
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Refill oil" }));
    await waitFor(() => expect(left(0)).toBe(60 * MINUTE));
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Light" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("lit"));
  });

  it("Pause freezes the lights; the rules switch and are undo steps", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    await waitFor(() => expect(saved().paused).toBe(true));
    vi.setSystemTime(T0 + 20 * MINUTE);
    expect(left(0)).toBe(60 * MINUTE);
    fireEvent.click(screen.getByRole("radio", { name: "Separate timers" }));
    await waitFor(() => expect(saved().lightingRule).toBe("separate"));
    expect(screen.getByRole("button", { name: "Undo: Lighting rule" })).toBeInTheDocument();
  });

  it("a torch that ran out shows spent and is replaced by a new one", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "torch", 5 * MINUTE)] } };
    scene(["a"]);
    render(<App />);
    await open();
    vi.setSystemTime(T0 + 6 * MINUTE);
    // The name follows a rename on the map; the next second's tick shows it out.
    await setItems([token("a", { name: "Aria the Bold" })]);
    await waitFor(() => expect(card("Torch · Aria the Bold")).toHaveTextContent("spent"), { timeout: 2000 });
    fireEvent.click(within(card("Torch · Aria the Bold")).getByRole("button", { name: "New torch" }));
    await waitFor(() => expect(saved().lights).toHaveLength(1));
    await waitFor(() => expect(saved().lights[0].status).toBe("lit"));
    expect(saved().lights[0].id).not.toBe("l1");
    expect(left(0)).toBe(60 * MINUTE);
  });

  it("players get no strip and no Light Tracker", async () => {
    obr.role = "PLAYER";
    scene([]);
    render(<App />);
    await screen.findByText("GM / Monsters");
    expect(screen.queryByRole("region", { name: "Lights" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Light Tracker" })).not.toBeInTheDocument();
  });
});

describe("the strip, badges and DIS", () => {
  const strip = () => screen.getByRole("region", { name: "Lights" });
  const rowOf = (name: string) => screen.getAllByRole("listitem").reverse().find((r) => within(r).queryByText(name))!;

  it("the GM clicks a torch's badge to put it out (spent), then for a new one", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    const badge = await screen.findByRole("button", { name: "Torch: 1:00:00 left. Click: put out torch" });
    vi.setSystemTime(T0 + 5 * MINUTE);
    fireEvent.click(badge);
    await waitFor(() => expect(saved().lights[0].status).toBe("spent"));
    fireEvent.click(await screen.findByRole("button", { name: "Torch: spent. Click: new torch" }));
    await waitFor(() => expect(saved().lights[0]?.status).toBe("lit"));
    expect(left(0)).toBe(60 * MINUTE);
  });

  it("a lantern's badge: put out keeps the oil, rounded down; clicked again it burns on", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "lantern")] } };
    scene(["a"]);
    render(<App />);
    const badge = await screen.findByRole("button", { name: "Lantern: 1:00:00 left. Click: put out lantern" });
    vi.setSystemTime(T0 + 5 * MINUTE);
    fireEvent.click(badge);
    await waitFor(() => expect(saved().lights[0]).toMatchObject({ status: "out", remainingMs: 45 * MINUTE }));
    fireEvent.click(await screen.findByRole("button", { name: "Lantern: out, 45:00 of oil. Click: light lantern" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("lit"));
    expect(left(0)).toBe(45 * MINUTE);
  });

  it("one badge per row: the lit light, not the lantern waiting out", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...lit("l1", "a", "lantern", 30 * MINUTE), status: "out", endsAt: null }, lit("l2", "a")] } };
    scene(["a"]);
    render(<App />);
    expect(await screen.findByRole("button", { name: /^Torch: 1:00:00 left/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Lantern/ })).not.toBeInTheDocument();
  });

  it("players see the badges and DIS but can't click them", async () => {
    obr.role = "PLAYER";
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a"), { ...lit("l2", "b"), status: "out", endsAt: null }] } };
    scene(["a", "b"]);
    render(<App />);
    expect(await screen.findByRole("img", { name: "Torch: 1:00:00 left" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Torch: spent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Click/ })).not.toBeInTheDocument();
  });

  it("total darkness: a red strip and DIS on living players' rows, not monsters, the dead or the GM row", async () => {
    obr.items = [token("a", { name: "Aria" }), token("d", { name: "Dead Dan" }), token("m", { name: "Goblin" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...lit("l1", "a"), status: "out", endsAt: null }] } };
    obr.sceneMetadata = {
      [TRACKER_KEY]: {
        entries: [
          { id: "a", roll: null, note: "", dead: false },
          { id: "d", roll: null, note: "", dead: true },
          { id: GM_ENTRY, roll: null, note: "", dead: false },
          { id: "m", roll: null, note: "", dead: false, monster: true },
        ],
        current: null,
        round: 0,
      },
    };
    render(<App />);
    await screen.findByText("Aria");
    expect(strip()).toHaveTextContent("No light · total darkness");
    expect(within(rowOf("Aria")).getByText("DIS")).toBeInTheDocument();
    expect(within(rowOf("Dead Dan")).queryByText("DIS")).not.toBeInTheDocument();
    expect(within(rowOf("Goblin")).queryByText("DIS")).not.toBeInTheDocument();
    expect(within(rowOf("GM / Monsters")).queryAllByText("DIS")).toHaveLength(0);
  });

  it("no lights tracked: never dark, no strip, no DIS", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene(["a"]);
    render(<App />);
    await screen.findByText("Aria");
    expect(screen.queryByRole("region", { name: "Lights" })).not.toBeInTheDocument();
    expect(screen.queryByText("DIS")).not.toBeInTheDocument();
  });

  it("a light burning out turns the room dark without a write, and the strip says which", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "torch", 1000)] } };
    scene(["a"]);
    render(<App />);
    await screen.findByText("Aria");
    expect(screen.queryByText("DIS")).not.toBeInTheDocument();
    vi.setSystemTime(T0 + 2000);
    expect(await screen.findByText("DIS", {}, { timeout: 2000 })).toBeInTheDocument();
    await waitFor(() => expect(strip()).toHaveTextContent("Torch · Aria burned out"), { timeout: 2000 });
  });

  it("darkness by the lights: a check every crawl round, the danger level kept, the card's switch locked", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [{ ...lit("l1", "a"), status: "spent", endsAt: null, remainingMs: 0 }] } };
    scene(["a"]);
    render(<App />);
    const card = await screen.findByRole("region", { name: "Encounter checks" });
    expect(card).toHaveTextContent("Total darkness (p. 84)");
    expect(card).toHaveTextContent("Total darkness: a check every crawl round");
    expect(within(card).getByLabelText("Danger level")).toHaveValue("unsafe");
    const toggle = within(card).getByRole("button", { name: /Darkness/ });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveTextContent("following light");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("no lights tracked: the card's switch sets darkness by hand, as an undo step", async () => {
    obr.items = [token("a", { name: "Aria" })];
    scene(["a"]);
    render(<App />);
    const card = await screen.findByRole("region", { name: "Encounter checks" });
    expect(card).toHaveTextContent("A check every 3 crawl rounds");
    fireEvent.click(within(card).getByRole("button", { name: /Darkness/ }));
    await waitFor(() => expect(card).toHaveTextContent("Total darkness: a check every crawl round"));
    expect(obr.sceneMetadata[TRACKER_KEY]).toMatchObject({ crawl: { dark: true, danger: "unsafe" } });
    expect(within(rowOf("Aria")).getByText("DIS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo: Darkness" })).toBeInTheDocument();
  });

  it("Follow light off: lights out isn't darkness unless the switch says so; the clock's die follows it, d8 face and all", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = {
      [LIGHTS_KEY]: { lights: [{ ...lit("l1", "a"), status: "spent", endsAt: null, remainingMs: 0 }] },
      [SETTINGS_KEY]: { followLight: false, encounterMode: "clock" },
    };
    scene(["a"]);
    render(<App />);
    const card = await screen.findByRole("region", { name: "Crawling Clock" });
    expect(card).toHaveTextContent("Crawling die d6");
    expect(screen.queryByText("DIS")).not.toBeInTheDocument();
    expect(strip()).not.toHaveTextContent("total darkness");
    // The die is drawn as a d6 (no diamond) until it's dark.
    expect(within(card).getByRole("button", { name: "Roll d6" }).querySelector("svg")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Darkness" }));
    await waitFor(() => expect(card).toHaveTextContent("Crawling die d8 (darkness)"));
    expect(within(card).getByRole("button", { name: "Roll d8" }).querySelector("svg polygon")).not.toBeNull();
    // The Light Tracker doesn't call it darkness either.
    fireEvent.click(screen.getByRole("button", { name: "Light Tracker" }));
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => /Follow light is off/.test(el.textContent ?? ""))).toBe(true));
    expect(screen.queryByText(/No light: total darkness/)).not.toBeInTheDocument();
  });

  it("Time passes from the strip", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    await screen.findByText("Aria");
    fireEvent.change(within(strip()).getByLabelText("Time passes"), { target: { value: "15m" } });
    fireEvent.click(within(strip()).getByRole("button", { name: "Time passes" }));
    await waitFor(() => expect(left(0)).toBe(45 * MINUTE));
  });
});
