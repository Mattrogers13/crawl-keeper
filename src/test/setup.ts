import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

import { resetObr } from "./obrMock";
import { resetDiceRoller } from "../diceRoller";

// Every test gets the in-memory SDK (src/test/obrMock.ts), reset between tests.
vi.mock("@owlbear-rodeo/sdk", async () => {
  const { OBR, buildImage } = await import("./obrMock");
  return { default: OBR, buildImage };
});

beforeEach(() => {
  resetObr();
  // What the roller knows about Dice+ (src/diceRoller.ts).
  resetDiceRoller();
  // Per-browser conveniences (src/storage.ts), e.g. the folded monsters.
  localStorage.clear();
  // The GM's undo history (src/undo.ts).
  sessionStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});
