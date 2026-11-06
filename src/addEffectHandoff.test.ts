import { describe, it, expect } from "vitest";

import { ID } from "./constants";
import { HANDOFF_MS, askToAddEffect, parseIds, takeHandoff } from "./addEffectHandoff";

describe("the Add effect handoff", () => {
  it("is taken once, fresh only", async () => {
    await askToAddEffect(["a", "b"], 1000);
    expect(takeHandoff(1000 + HANDOFF_MS)).toEqual(["a", "b"]);
    expect(takeHandoff(1000 + HANDOFF_MS)).toBeNull();
    await askToAddEffect(["a"], 1000);
    expect(takeHandoff(1001 + HANDOFF_MS)).toBeNull();
    // A clock that went backwards isn't fresh either.
    await askToAddEffect(["a"], 1000);
    expect(takeHandoff(999)).toBeNull();
  });

  it("keeps malformed data out", () => {
    expect(parseIds(["a", "a", "b"])).toEqual(["a", "b"]);
    expect(parseIds([])).toBeNull();
    expect(parseIds(["a", 3])).toBeNull();
    expect(parseIds("a")).toBeNull();
    expect(parseIds(["x".repeat(65)])).toBeNull();
    expect(parseIds(Array.from({ length: 41 }, (_, i) => `t${i}`))).toBeNull();
    sessionStorage.setItem(`${ID}/add-effect`, "{not json");
    expect(takeHandoff()).toBeNull();
  });
});
