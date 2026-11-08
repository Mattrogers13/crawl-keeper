import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { EFFECTS_KEY, TRACKER_KEY } from "../constants";
import { GM_ENTRY, parseTracker } from "../tracker";
import { obr, token } from "../test/obrMock";

const saved = () => parseTracker(obr.sceneMetadata[TRACKER_KEY]);
const ZOMBIE = "https://example.com/zombie.png";

// Aria; the GM row with three zombies (one image, numbered names), a wolf,
// and a "Zombie" with other art (not the same monster).
const setup = (current: string | null = "a", fx: object[] = []) => {
  obr.items = [
    token("a", { name: "Aria" }),
    token("z1", { name: "Zombie", url: ZOMBIE }),
    token("w", { name: "Wolf" }),
    token("z2", { name: "Zombie 2", url: ZOMBIE }),
    token("z3", { name: "Zombie #3", url: ZOMBIE }),
    token("zx", { name: "Zombie", url: "https://example.com/other.png" }),
  ];
  obr.sceneMetadata = {
    [TRACKER_KEY]: {
      entries: [{ id: "a" }, { id: GM_ENTRY }, ...["z1", "w", "z2", "z3", "zx"].map((id) => ({ id, monster: true }))].map((e) => ({ roll: null, note: "", dead: false, ...e })),
      current,
      round: 1,
      phase: "combat",
    },
    [EFFECTS_KEY]: { effects: fx },
  };
  render(<App />);
};
const monsters = () => within(screen.getByRole("list", { name: "Monsters" }));

describe("identical monsters stack", () => {
  it("one line per stack, where its first member is; a lone monster (or other art) stays a row", async () => {
    setup();
    const stack = await screen.findByRole("button", { name: "Show Zombie ×3" });
    expect(stack).toHaveAttribute("aria-expanded", "false");
    const names = monsters()
      .getAllByRole("listitem")
      .map((li) => li.textContent?.trim());
    expect(names[0]).toMatch(/^└Zombie ×3/);
    expect(names.slice(1).map((n) => n?.replace(/[^A-Za-z ]/g, "").trim())).toEqual(["Wolf", "Zombie"]);
    expect(screen.queryByText("Zombie 2")).toBeNull();
    fireEvent.click(stack);
    expect(within(screen.getByRole("list", { name: "Zombie ×3" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Zombie 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fold Zombie ×3" }));
    expect(screen.queryByText("Zombie 2")).toBeNull();
  });

  it("the stack's line shows what's on them: dead and effect icons", async () => {
    setup("a", [{ id: "e1", name: "Paralyzed", icon: "paralyzed", kind: "until", holder: "z2" }]);
    const stack = await screen.findByRole("button", { name: "Show Zombie ×3" });
    expect(stack.querySelector('img[src="/img/effect-paralyzed.webp"]')).not.toBeNull();
  });

  it("the GM's menu on the stack acts on all of them: Mark dead, one undo step; the line counts the dead", async () => {
    setup();
    const stack = await screen.findByRole("button", { name: "Show Zombie ×3" });
    fireEvent.contextMenu(stack);
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Mark dead" }));
    await waitFor(() => expect(saved().entries.filter((e) => e.dead).map((e) => e.id)).toEqual(["z1", "z2", "z3"]));
    expect(await screen.findByRole("button", { name: "Show Zombie ×3" })).toHaveTextContent("3 dead");
    expect(screen.getByRole("button", { name: "Undo: Mark dead" })).toBeInTheDocument();
  });

  it("open while one of them has the turn (it can't fold then)", async () => {
    setup("z2");
    const fold = await screen.findByRole("button", { name: "Fold Zombie ×3" });
    expect(fold).toBeDisabled();
    expect(screen.getByText("Zombie 2").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("players see the stack too", async () => {
    obr.role = "PLAYER";
    setup();
    expect(await screen.findByRole("button", { name: "Show Zombie ×3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^More for Zombie/ })).toBeNull();
  });
});
