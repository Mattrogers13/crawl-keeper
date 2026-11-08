// Where the players stand when the party regroups or splits (Matt,
// 2026-11-07, option 2): pure geometry. The rally point is the Party token
// (the GM drags it, hidden, to where the party gathers). Each player takes the
// nearest free spot around it on their own side, where a straight line from
// the rally point crosses no wall and the token stays half a cell clear of
// walls; with none, they stack on the rally point. Walls are Dynamic Fog's
// (the GM's browser builds them from the fog tool's shapes), as polylines in
// map px. Spots come in already snapped to the grid (the SDK snaps them).
import type { Point } from "./tracker";

export type Placed = { id: string; center: Point };
export type Wall = Point[];

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

// Do segments ab and cd cross (touching counts)?
export const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: Point, q: Point, r: Point) => cross(p, q, r) === 0 && Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x) && Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y);
  return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
};

// Distance from p to segment ab.
export const toSegment = (p: Point, a: Point, b: Point): number => {
  const ab = sub(b, a);
  const len = ab.x * ab.x + ab.y * ab.y;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len));
  return dist(p, { x: a.x + t * ab.x, y: a.y + t * ab.y });
};

type Segment = readonly [Point, Point];
const segments = (walls: Wall[]): Segment[] => walls.flatMap((w) => w.slice(1).map((b, i) => [w[i], b] as const));
const reach = (from: Point, spot: Point, segs: Segment[], clear: number) => segs.every(([a, b]) => !crosses(from, spot, a, b) && toSegment(spot, a, b) >= clear);

// A spot a token can stand on, reached from the rally point.
export const reachable = (from: Point, spot: Point, walls: Wall[], clear: number): boolean => reach(from, spot, segments(walls), clear);

// Spots around the rally point, ring by ring (`cell` apart, up to `rings`
// out), nearest first; the SDK snaps them to the grid afterwards.
export const around = (center: Point, cell: number, rings = 3): Point[] => {
  const out: Point[] = [];
  for (let r = 1; r <= rings; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ x: center.x + dx * cell, y: center.y + dy * cell });
  return out;
};

// Each player to the nearest free reachable spot on their side of the rally
// point (closest players choose first). `taken`: spots already held (other
// tokens). A player with nothing left stacks on the rally point.
export const gather = (rally: Point, players: Placed[], spots: Point[], walls: Wall[], cell: number, taken: Point[] = []): Record<string, Point> => {
  const clear = cell / 2;
  const held = [...taken];
  const free = (p: Point) => held.every((h) => dist(h, p) >= cell / 2);
  const segs = segments(walls);
  const legal = spots.filter((p) => reach(rally, p, segs, clear));
  const out: Record<string, Point> = {};
  for (const pl of [...players].sort((a, b) => dist(a.center, rally) - dist(b.center, rally))) {
    const away = dist(pl.center, rally);
    // Where they'd stand on their own side, one cell out.
    const want = away === 0 ? rally : { x: rally.x + ((pl.center.x - rally.x) / away) * cell, y: rally.y + ((pl.center.y - rally.y) / away) * cell };
    const best = legal.filter(free).sort((a, b) => dist(a, want) + dist(a, rally) / 2 - (dist(b, want) + dist(b, rally) / 2))[0];
    const spot = best ?? rally;
    out[pl.id] = spot;
    if (best) held.push(best);
  }
  return out;
};

// After travelling attached, the players who ended up behind or in a wall
// (from the Party token's spot): they move to a legal spot; the rest stay.
export const strays = (rally: Point, players: Placed[], walls: Wall[], cell: number): Placed[] => {
  const segs = segments(walls);
  return players.filter((p) => !reach(rally, p.center, segs, cell / 2));
};
