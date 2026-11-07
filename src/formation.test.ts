import { describe, it, expect } from "vitest";

import { centroid, combine, expand } from "./formation";

const at = (id: string, x: number, y: number) => ({ id, center: { x, y } });

describe("combine", () => {
  it("moves the Party token to the players' centre and remembers each offset from it", () => {
    const r = combine(at("p", 0, 0), [at("a", 100, 100), at("b", 300, 100), at("c", 200, 400)]);
    expect(r.move).toEqual({ p: { x: 200, y: 200 } });
    expect(r.formation).toEqual({ a: { x: -100, y: -100 }, b: { x: 100, y: -100 }, c: { x: 0, y: 200 } });
  });

  it("no players, nothing to do", () => {
    expect(combine(at("p", 5, 5), [])).toEqual({ move: {}, formation: {} });
  });

  it("whole pixels", () => {
    const r = combine(at("p", 0, 0), [at("a", 0, 0), at("b", 1, 0), at("c", 1, 0)]);
    expect(Number.isInteger(r.move.p.x)).toBe(true);
    expect(Object.values(r.formation).every((o) => Number.isInteger(o.x) && Number.isInteger(o.y))).toBe(true);
  });
});

describe("expand", () => {
  it("puts each player back in the shape around the Party token, wherever it is now", () => {
    const formation = { a: { x: -100, y: -100 }, b: { x: 100, y: -100 } };
    // The Party token has travelled to (1000, 500); the players' tokens still sit where they were.
    const move = expand({ x: 1000, y: 500 }, formation, [at("a", 100, 100), at("b", 300, 100)], 150);
    expect(move).toEqual({ a: { x: 800, y: 300 }, b: { x: 800, y: 300 } });
  });

  it("round trip: combine then expand in place returns every player to where they stood", () => {
    const players = [at("a", 120, 80), at("b", 340, 90), at("c", 200, 410)];
    const { move, formation } = combine(at("p", 0, 0), players);
    const partyCenter = { x: move.p.x, y: move.p.y };
    const back = expand(partyCenter, formation, players, 150);
    expect(Object.values(back).every((d) => d.x === 0 && d.y === 0)).toBe(true);
  });

  it("a player with no remembered spot takes a place on a ring around the Party token", () => {
    const move = expand({ x: 500, y: 500 }, {}, [at("a", 0, 0), at("b", 0, 0)], 100);
    const spots = Object.entries(move).map(([, d]) => ({ x: d.x, y: d.y }));
    expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(2);
    for (const s of spots) expect(Math.round(Math.hypot(s.x - 500, s.y - 500))).toBe(150);
  });
});

describe("centroid", () => {
  it("the mean of the points", () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 });
  });
});
