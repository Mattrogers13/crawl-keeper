import { describe, expect, it } from "vitest";

import { stackKey, stackName, stacks } from "./stacks";

describe("monster stacks", () => {
  it("the name without a trailing number", () => {
    expect(stackName("Goblin 2")).toBe("Goblin");
    expect(stackName("Goblin #3")).toBe("Goblin");
    expect(stackName(" Goblin ")).toBe("Goblin");
    expect(stackName("Goblin3")).toBe("Goblin");
    expect(stackName("12")).toBe("12");
    expect(stackName("Room 2 Guard")).toBe("Room 2 Guard");
  });

  it("identical: same name stem (any case) and the same image", () => {
    expect(stackKey("Goblin 2", "g.png")).toBe(stackKey("goblin", "g.png"));
    expect(stackKey("Guard", "a.png")).not.toBe(stackKey("Guard", "b.png"));
    expect(stackKey("Goblin", null)).not.toBe(stackKey("Goblin", "g.png"));
  });

  it("groups in the order shown: each stack where its first member is", () => {
    const list = ["g1", "w1", "g2", "o1", "g3", "w2"];
    expect(stacks(list, (s) => s[0])).toEqual([
      { key: "g", members: ["g1", "g2", "g3"] },
      { key: "w", members: ["w1", "w2"] },
      { key: "o", members: ["o1"] },
    ]);
    expect(stacks([], (s: string) => s)).toEqual([]);
  });
});
