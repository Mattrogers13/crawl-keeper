import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { LIGHTS_KEY, TRACKER_KEY } from "../constants";
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
  shuttered: false,
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
    await waitFor(() => expect(saved().lights.map((l) => [l.kind, l.status])).toEqual([["torch", "out"], ["lantern", "lit"]]));
    expect(screen.getByRole("button", { name: "Undo: Swap torch for lantern" })).toBeInTheDocument();
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
    fireEvent.click(await screen.findByLabelText("Light Tracker"));
    await screen.findByRole("heading", { name: "Light Tracker" });
    await screen.findByRole("button", { name: "Put lights out" });
  };

  it("opens from the flame, says how to start a light, and goes back", async () => {
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

  it("Put out, Resume and Remove, each an undo step", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a")] } };
    scene(["a"]);
    render(<App />);
    await open();
    vi.setSystemTime(T0 + 10 * MINUTE);
    fireEvent.click(within(card("Torch · Aria")).getByRole("button", { name: "Put out" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("out"));
    expect(screen.getByRole("status")).toHaveTextContent(/total darkness/);
    vi.setSystemTime(T0 + 30 * MINUTE);
    fireEvent.click(within(card("Torch · Aria")).getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("lit"));
    expect(left(0)).toBe(50 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Undo: Resume torch" }));
    await waitFor(() => expect(saved().lights[0].status).toBe("out"));
    fireEvent.click(within(card("Torch · Aria")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(saved().lights).toHaveLength(0));
    expect(screen.getByRole("button", { name: "Undo: Remove torch" })).toBeInTheDocument();
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

  it("Put lights out offers Undo in a toast", async () => {
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin" })];
    obr.metadata = { [LIGHTS_KEY]: { lightingRule: "separate", lights: [lit("l1", "a"), lit("l2", "b", "lightSpell")] } };
    scene(["a", "b"]);
    render(<App />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Put lights out" }));
    await waitFor(() => expect(saved().lights.map((l) => l.status)).toEqual(["out", "out"]));
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

  it("lanterns shutter (dark, still burning) and take oil", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "lantern", 20 * MINUTE)] } };
    scene(["a"]);
    render(<App />);
    await open();
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Shutter" }));
    await waitFor(() => expect(saved().lights[0].shuttered).toBe(true));
    expect(screen.getByRole("status")).toHaveTextContent(/total darkness/);
    fireEvent.click(within(card("Lantern · Aria")).getByRole("button", { name: "Refill oil" }));
    await waitFor(() => expect(left(0)).toBe(60 * MINUTE));
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
    fireEvent.click(screen.getByRole("radio", { name: "Treat as newly lit" }));
    await waitFor(() => expect(saved().relightRule).toBe("lightingRule"));
    expect(screen.getByRole("button", { name: "Undo: Relight rule" })).toBeInTheDocument();
  });

  it("a light that ran out shows burned out and relights as the same light", async () => {
    obr.items = [token("a", { name: "Aria" })];
    obr.metadata = { [LIGHTS_KEY]: { lights: [lit("l1", "a", "torch", 5 * MINUTE)] } };
    scene(["a"]);
    render(<App />);
    await open();
    vi.setSystemTime(T0 + 6 * MINUTE);
    // The name follows a rename on the map; the next second's tick shows it out.
    await setItems([token("a", { name: "Aria the Bold" })]);
    await waitFor(() => expect(card("Torch · Aria the Bold")).toHaveTextContent("burned out"), { timeout: 2000 });
    fireEvent.click(within(card("Torch · Aria the Bold")).getByRole("button", { name: "Relight" }));
    await waitFor(() => expect(saved().lights[0]).toMatchObject({ id: "l1", status: "lit" }));
    expect(left(0)).toBe(60 * MINUTE);
  });

  it("players get no Light Tracker", async () => {
    obr.role = "PLAYER";
    scene([]);
    render(<App />);
    await screen.findByText("GM / Monsters");
    expect(screen.queryByLabelText("Light Tracker")).not.toBeInTheDocument();
  });
});
