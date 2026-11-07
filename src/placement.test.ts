import { describe, it, expect } from "vitest";

import { around, crosses, gather, reachable, strays, toSegment } from "./placement";

const P = (x: number, y: number) => ({ x, y });
const at = (id: string, x: number, y: number) => ({ id, center: P(x, y) });
const CELL = 100;

describe("geometry", () => {
  it("crosses: a cross, a miss, a touch", () => {
    expect(crosses(P(0, 0), P(10, 10), P(0, 10), P(10, 0))).toBe(true);
    expect(crosses(P(0, 0), P(10, 0), P(0, 5), P(10, 5))).toBe(false);
    expect(crosses(P(0, 0), P(10, 0), P(10, 0), P(10, 10))).toBe(true);
  });

  it("toSegment: perpendicular and past the end", () => {
    expect(toSegment(P(5, 5), P(0, 0), P(10, 0))).toBe(5);
    expect(toSegment(P(13, 4), P(0, 0), P(10, 0))).toBe(5);
  });

  it("around: ring by ring, nearest ring first, no centre", () => {
    const spots = around(P(0, 0), CELL, 2);
    expect(spots).toHaveLength(8 + 16);
    expect(spots.slice(0, 8).every((p) => Math.max(Math.abs(p.x), Math.abs(p.y)) === CELL)).toBe(true);
    expect(spots.some((p) => p.x === 0 && p.y === 0)).toBe(false);
  });
});

describe("gather", () => {
  const spots = around(P(0, 0), CELL);

  it("no walls: each player on their own side, one cell out, no two on one spot", () => {
    const r = gather(P(0, 0), [at("e", 900, 0), at("w", -700, 0), at("n", 0, -400)], spots, [], CELL);
    expect(r).toEqual({ n: P(0, -100), w: P(-100, 0), e: P(100, 0) });
  });

  it("a wall between the rally point and a player's side: they take a spot on this side", () => {
    // A wall just east of the rally point, top to bottom.
    const wall = [P(60, -500), P(60, 500)];
    const r = gather(P(0, 0), [at("e", 900, 0)], spots, [wall], CELL);
    expect(r.e.x).toBeLessThan(60);
    expect(reachable(P(0, 0), r.e, [wall], CELL / 2)).toBe(true);
  });

  it("other tokens' spots are taken; nowhere legal: stack on the rally point", () => {
    const r = gather(P(0, 0), [at("e", 900, 0)], spots, [], CELL, [P(100, 0)]);
    expect(r.e).not.toEqual(P(100, 0));
    // Boxed in on every side.
    const box = [P(-40, -40), P(40, -40), P(40, 40), P(-40, 40), P(-40, -40)];
    expect(gather(P(0, 0), [at("e", 900, 0)], spots, [box], CELL)).toEqual({ e: P(0, 0) });
  });
});

describe("strays", () => {
  it("only those behind a wall from the Party token, or too close to one", () => {
    const wall = [P(150, -500), P(150, 500)];
    const out = strays(P(0, 0), [at("ok", -100, 0), at("behind", 300, 0), at("tight", 120, 0)], [wall], CELL);
    expect(out.map((p) => p.id)).toEqual(["behind", "tight"]);
  });
});
