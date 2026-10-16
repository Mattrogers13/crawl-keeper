import { describe, it, expect, vi, afterEach } from "vitest";

import { readLocal, writeLocal } from "./storage";

describe("browser storage that throws (strict privacy settings)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("reads as empty and drops writes instead of crashing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readLocal("x")).toBeNull();
    expect(() => writeLocal("x", "1")).not.toThrow();
  });

  it("round-trips when storage works", () => {
    writeLocal("x", "1");
    expect(readLocal("x")).toBe("1");
  });
});
