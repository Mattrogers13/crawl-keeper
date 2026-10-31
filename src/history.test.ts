import { describe, it, expect } from "vitest";

import { EMPTY, MAX_STEPS, afterRedo, afterUndo, parseHistory, pushStep, trim, type History, type Step } from "./history";

const step = (id: string, extra: Partial<Step> = {}): Step => ({
  id,
  label: `Step ${id}`,
  scene: null,
  changes: [{ store: "room", key: "k", before: 1, after: 2 }],
  toast: false,
  ...extra,
});

describe("history", () => {
  it("a new action goes on top, clears Redo, and keeps the newest 50", () => {
    let h: History = { undo: [], redo: [step("r")] };
    h = pushStep(h, step("a"));
    expect(h).toEqual({ undo: [step("a")], redo: [] });
    for (let i = 0; i < MAX_STEPS + 5; i++) h = pushStep(h, step(`s${i}`));
    expect(h.undo).toHaveLength(MAX_STEPS);
    expect(h.undo[0].id).toBe("s5");
  });

  it("undo and redo move the step they applied, by id, even with a newer one on top", () => {
    const a = step("a");
    const b = step("b");
    // `a` was being undone while the background page recorded `b`.
    expect(afterUndo({ undo: [a, b], redo: [] }, a, true)).toEqual({ undo: [b], redo: [a] });
    expect(afterRedo({ undo: [b], redo: [a] }, a, true)).toEqual({ undo: [b, a], redo: [] });
  });

  it("a step that couldn't be applied (another map) is dropped, not moved", () => {
    const a = step("a");
    expect(afterUndo({ undo: [a], redo: [] }, a, false)).toEqual(EMPTY);
    expect(afterRedo({ undo: [], redo: [a] }, a, false)).toEqual(EMPTY);
  });

  it("a step already gone (applied twice) changes nothing", () => {
    const h = { undo: [step("b")], redo: [] };
    expect(afterUndo(h, step("a"), true)).toBe(h);
    expect(afterRedo(h, step("a"), true)).toBe(h);
  });

  it("trim keeps the newest undo steps and all of Redo", () => {
    expect(trim({ undo: [step("a"), step("b"), step("c")], redo: [step("r")] }, 1)).toEqual({ undo: [step("c")], redo: [step("r")] });
  });

  it("reads storage defensively: bad JSON, bad steps and junk fields are dropped", () => {
    expect(parseHistory(null)).toEqual(EMPTY);
    expect(parseHistory("{nope")).toEqual(EMPTY);
    expect(parseHistory("[1,2]")).toEqual(EMPTY);
    const good = step("a", { scene: "map-1", toast: true });
    const json = JSON.stringify({
      undo: [good, { id: "x", label: "No changes", changes: [] }, { id: "y", label: "Bad store", changes: [{ store: "disk", key: "k" }] }, "junk"],
      redo: [{ label: "No id", changes: good.changes }],
    });
    expect(parseHistory(json)).toEqual({ undo: [good], redo: [] });
    expect(parseHistory(JSON.stringify({ undo: [step("a", { label: "x".repeat(200) })] })).undo[0].label).toHaveLength(60);
  });
});
