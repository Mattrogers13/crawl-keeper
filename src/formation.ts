// Combine and expand (Matt, 2026-11-07): the geometry, pure. When the party
// comes together the Party token moves to the players' centre and each
// player's offset from it is remembered; on Split the players go back to that
// shape around wherever the Party token is now. Centres are the tokens'
// bounding-box centres (px on the map), so tokens of different sizes line up.
import type { Point } from "./tracker";

export type Placed = { id: string; center: Point };
export type Move = Record<string, Point>;

export const centroid = (points: Point[]): Point => ({
  x: points.reduce((a, p) => a + p.x, 0) / points.length,
  y: points.reduce((a, p) => a + p.y, 0) / points.length,
});

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

// Together: the Party token's move to the players' centre, and the formation
// to keep. No players: nothing to move.
export const combine = (party: Placed, players: Placed[]): { move: Move; formation: Record<string, Point> } => {
  if (players.length === 0) return { move: {}, formation: {} };
  const mid = centroid(players.map((p) => p.center));
  return {
    move: { [party.id]: round(sub(mid, party.center)) },
    formation: Object.fromEntries(players.map((p) => [p.id, round(sub(p.center, mid))])),
  };
};

// Split: each player's move to its remembered spot around the Party token's
// centre. A player with none (they joined since) takes a place on a ring
// around it, `cell` px out, after those already placed.
export const expand = (partyCenter: Point, formation: Record<string, Point>, players: Placed[], cell: number): Move => {
  const move: Move = {};
  const fresh = players.filter((p) => !formation[p.id]);
  players.forEach((p) => {
    const offset = formation[p.id];
    if (offset) return void (move[p.id] = round(sub(add(partyCenter, offset), p.center)));
    const i = fresh.indexOf(p);
    const angle = (2 * Math.PI * i) / Math.max(fresh.length, 1) - Math.PI / 2;
    const spot = add(partyCenter, { x: Math.cos(angle) * cell * 1.5, y: Math.sin(angle) * cell * 1.5 });
    move[p.id] = round(sub(spot, p.center));
  });
  return move;
};
