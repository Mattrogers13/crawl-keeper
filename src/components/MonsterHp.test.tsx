import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, token } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const ZOMBIE = "https://example.com/zombie.png";
const hpOf = (id: string) => saved().entries.find((e) => e.id === id)?.hp;

// Aria, three zombies (a stack), a wolf; `hp` per monster id.
const setup = (hp: Record<string, { cur: number; max: number }> = {}, role: "GM" | "PLAYER" = "GM") => {
  obr.role = role;
  obr.items = [
    token("a", { name: "Aria" }),
    token("z1", { name: "Zombie", url: ZOMBIE }),
    token("z2", { name: "Zombie 2", url: ZOMBIE }),
    token("z3", { name: "Zombie #3", url: ZOMBIE }),
    token("w", { name: "Wolf" }),
  ];
  obr.sceneMetadata = {
    [TRACKER_KEY]: {
      entries: [{ id: "a" }, { id: GM_ENTRY }, ...["z1", "z2", "z3", "w"].map((id) => ({ id, monster: true, hp: hp[id] }))].map((e) => ({
        roll: null,
        note: "",
        dead: false,
        ...e,
      })),
      current: null,
      round: 1,
      phase: "combat",
    },
  };
  render(<App />);
};
const type = (box: HTMLElement, text: string) => {
  fireEvent.change(box, { target: { value: text } });
  fireEvent.blur(box);
};

describe("monster HP", () => {
  it("a monster row's box starts HP, hurts and heals, one undo step each", async () => {
    setup();
    const box = await screen.findByLabelText("HP for Wolf");
    type(box, "12");
    await waitFor(() => expect(hpOf("w")).toEqual({ cur: 12, max: 12 }));
    type(await screen.findByLabelText("HP for Wolf"), "-5");
    await waitFor(() => expect(hpOf("w")).toEqual({ cur: 7, max: 12 }));
    expect(await screen.findByLabelText("HP for Wolf")).toHaveValue("7/12");
    fireEvent.click(screen.getByRole("button", { name: "Undo: Monster HP" }));
    await waitFor(() => expect(hpOf("w")).toEqual({ cur: 12, max: 12 }));
  });

  it("focusing the box selects its text, so typing -3 replaces 7/12", async () => {
    setup({ w: { cur: 7, max: 12 } });
    const box = (await screen.findByLabelText("HP for Wolf")) as HTMLInputElement;
    fireEvent.focus(box);
    await waitFor(() => expect([box.selectionStart, box.selectionEnd]).toEqual([0, 4]));
  });

  it("junk text puts the old value back and saves nothing", async () => {
    setup({ w: { cur: 4, max: 9 } });
    const box = await screen.findByLabelText("HP for Wolf");
    type(box, "lots");
    expect(await screen.findByLabelText("HP for Wolf")).toHaveValue("4/9");
    expect(hpOf("w")).toEqual({ cur: 4, max: 9 });
  });

  it("at 0 HP a skull offers Mark dead; nothing is marked by itself", async () => {
    setup({ w: { cur: 3, max: 9 } });
    type(await screen.findByLabelText("HP for Wolf"), "-3");
    const skull = await screen.findByRole("button", { name: "Mark Wolf dead" });
    expect(saved().entries.find((e) => e.id === "w")?.dead).toBe(false);
    fireEvent.click(skull);
    await waitFor(() => expect(saved().entries.find((e) => e.id === "w")?.dead).toBe(true));
    expect(hpOf("w")).toEqual({ cur: 0, max: 9 });
  });

  it("a stack's box gives all of them HP, and -3 hurts each one", async () => {
    setup();
    type(await screen.findByLabelText("HP for all Zombie"), "10");
    await waitFor(() => expect(["z1", "z2", "z3"].map(hpOf)).toEqual(Array(3).fill({ cur: 10, max: 10 })));
    expect(await screen.findByLabelText("HP for all Zombie")).toHaveValue("30/30");
    type(screen.getByLabelText("HP for all Zombie"), "-4");
    await waitFor(() => expect(["z1", "z2", "z3"].map(hpOf)).toEqual(Array(3).fill({ cur: 6, max: 10 })));
    expect(hpOf("w")).toBeUndefined();
  });

  it("a monster marked later starts at its kind's max", async () => {
    setup({ z1: { cur: 5, max: 10 }, z2: { cur: 10, max: 10 } });
    obr.sceneMetadata[TRACKER_KEY] = {
      ...(obr.sceneMetadata[TRACKER_KEY] as object),
      entries: saved().entries.map((e) => (e.id === "z3" ? { ...e, monster: false } : e)),
    };
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Zombie #3" }));
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Mark as monster" }));
    await waitFor(() => expect(hpOf("z3")).toEqual({ cur: 10, max: 10 }));
    // The other kind, the wolf, is untouched.
    expect(hpOf("w")).toBeUndefined();
  });

  it("players see no HP", async () => {
    setup({ w: { cur: 4, max: 9 } }, "PLAYER");
    await screen.findByText("Wolf");
    expect(screen.queryByLabelText("HP for Wolf")).toBeNull();
    expect(screen.queryByText("4/9")).toBeNull();
  });
});
