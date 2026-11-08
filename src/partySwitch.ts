// The Party / Split switch (docs/design.md, "Party and player tokens"):
// pure. Coming together, the players' lights go to the Party token; splitting,
// the Party token's light goes to one player, the carrier (Matt: a chosen
// carrier, not whoever has the turn). The tracker half is setTogether
// (tracker.ts); this adds the lights, which move with their timers
// (moveLight, lights.ts).
import { moveLight, settle, type Lights } from "./lights";
import { partyMembers, setTogether, type Tracker } from "./tracker";

export type Switch =
  // Done: the new tracker and lights; `stayed` lights couldn't move (the
  // destination already burns one) and keep their token.
  | { done: true; tracker: Tracker; lights: Lights; stayed: number }
  // Splitting with a light on the Party token and no carrier to give it to:
  // the player entries to choose from.
  | { done: false; choices: string[] };

const holds = (s: Lights, id: string) => s.lights.filter((l) => l.tokenId === id && (l.status === "lit" || l.status === "out"));

// The living player entries that can carry the party's light.
export const carriers = partyMembers;

// `pick`: the carrier chosen for a split (else the remembered one). `nameOf`
// is a token's name for the light's carrier label.
export const planSwitch = (
  t: Tracker,
  lights: Lights,
  now: number,
  together: boolean,
  nameOf: (id: string) => string,
  pick?: string,
): Switch => {
  if (t.party === null || t.together === together) return { done: true, tracker: t, lights, stayed: 0 };
  const party = t.party;
  const settled = settle(lights, now);
  const players = carriers(t);
  let s = settled;
  let stayed = 0;
  const moveAll = (from: string[], to: string) => {
    let first: string | null = null;
    for (const l of from.flatMap((id) => holds(settled, id))) {
      try {
        s = moveLight(s, now, l.id, to, nameOf(to));
        first ??= l.tokenId;
      } catch {
        stayed++;
      }
    }
    return first;
  };
  if (together) {
    // Whoever carried the party's light is remembered as the next carrier.
    const from = moveAll(players, party);
    return { done: true, tracker: setTogether(t, true, from ?? t.carrier), lights: s, stayed };
  }
  if (holds(settled, party).length === 0 || players.length === 0) {
    return { done: true, tracker: setTogether(t, false), lights: lights, stayed: players.length === 0 && holds(settled, party).length > 0 ? holds(settled, party).length : 0 };
  }
  const to = pick && players.includes(pick) ? pick : t.carrier && players.includes(t.carrier) ? t.carrier : null;
  if (to === null) return { done: false, choices: players };
  moveAll([party], to);
  return { done: true, tracker: setTogether(t, false, to), lights: s, stayed };
};
