import { describe, it, expect } from "vitest";

import { NO_SELECTION, clickRow, keepRows, menuTargets } from "./selection";

const order = ["a", "b", "c", "d", "e"];
const plain = { shift: false, toggle: false };
const shift = { shift: true, toggle: false };
const toggle = { shift: false, toggle: true };

describe("clickRow", () => {
  it("plain click selects one row; clicking it again clears", () => {
    const s = clickRow(NO_SELECTION, "b", order, plain);
    expect(s).toEqual({ ids: ["b"], anchor: "b" });
    expect(clickRow(s, "b", order, plain)).toEqual(NO_SELECTION);
    expect(clickRow(s, "d", order, plain)).toEqual({ ids: ["d"], anchor: "d" });
  });

  it("Shift selects the range from the last click, either direction", () => {
    const s = clickRow(NO_SELECTION, "b", order, plain);
    expect(clickRow(s, "d", order, shift).ids).toEqual(["b", "c", "d"]);
    expect(clickRow(clickRow(NO_SELECTION, "d", order, plain), "a", order, shift).ids).toEqual(["a", "b", "c", "d"]);
  });

  it("Shift with nothing clicked yet is a plain click", () => {
    expect(clickRow(NO_SELECTION, "c", order, shift)).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("Cmd / Ctrl adds or removes single rows anywhere", () => {
    let s = clickRow(NO_SELECTION, "a", order, toggle);
    s = clickRow(s, "d", order, toggle);
    s = clickRow(s, "e", order, toggle);
    expect(s.ids).toEqual(["a", "d", "e"]);
    expect(clickRow(s, "d", order, toggle).ids).toEqual(["a", "e"]);
  });
});

describe("menuTargets / keepRows", () => {
  it("a menu inside the selection uses it all; outside, just that row", () => {
    const s = { ids: ["a", "c"], anchor: "c" };
    expect(menuTargets(s, "a")).toBe(s);
    expect(menuTargets(s, "b")).toEqual({ ids: ["b"], anchor: "b" });
  });

  it("rows that went away drop out; unchanged keeps the object", () => {
    const s = { ids: ["a", "c"], anchor: "c" };
    expect(keepRows(s, order)).toBe(s);
    expect(keepRows(s, ["a", "b"])).toEqual({ ids: ["a"], anchor: null });
  });
});
