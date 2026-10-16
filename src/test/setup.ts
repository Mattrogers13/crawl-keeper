import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

import { resetObr } from "./obrMock";

// Every test gets the in-memory SDK (src/test/obrMock.ts), reset between tests.
vi.mock("@owlbear-rodeo/sdk", async () => {
  const { OBR } = await import("./obrMock");
  return { default: OBR };
});

beforeEach(() => {
  resetObr();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});
