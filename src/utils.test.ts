import { describe, it, expect } from "vitest";

import { errorMessage } from "./utils";

describe("errorMessage", () => {
  it("reads Errors, Owlbear's plain error objects, and anything else", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage({ name: "NotFound", message: "Item not found" })).toBe("Item not found");
    expect(errorMessage({ error: { message: "Nested" } })).toBe("Nested");
    expect(errorMessage({ code: 4 })).toBe('{"code":4}');
    expect(errorMessage("text")).toBe("text");
    expect(errorMessage({})).not.toBe("[object Object]");
  });
});
