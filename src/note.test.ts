import { describe, it, expect } from "vitest";
import { NOTE_MAX, parseNote } from "./note";

describe("parseNote", () => {
  it("reads missing or malformed values as empty", () => {
    expect(parseNote(undefined)).toBe("");
    expect(parseNote(null)).toBe("");
    expect(parseNote(42)).toBe("");
    expect(parseNote({ text: "hi" })).toBe("");
  });

  it("caps the length", () => {
    expect(parseNote("x".repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX);
  });
});
