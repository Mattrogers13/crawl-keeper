// Where Crawl Keeper's rolls come from (v0.5, Matt 2026-11-06): Dice+ when
// it's installed and Settings → Roll with Dice+ is on, so the table sees the
// dice; else this browser's crypto, as before.
//
// Dice+'s broadcast API (its store page, "Extension Integration"):
// `dice-plus/isReady` {requestId, timestamp} is answered on the same channel
// with ready: true; `dice-plus/roll-request` {rollId, playerId, playerName,
// rollTarget, diceNotation, showResults, timestamp, source} is answered on
// `${source}/roll-result` (result.groups[].dice[].value / kept) or
// `${source}/roll-error`. Unverified until a room test: LOCAL vs ALL (the
// docs use ALL; a fork's README says LOCAL), and whether "everyone" shows
// to players for a source Dice+ doesn't know (docs/obr/gotchas.md).
//
// The Dice+ check runs in the background (panel start, setting change, and
// again before a roll while it's not found), so rolls never wait for it:
// until Dice+ has answered, rolls are local and instant.
import OBR from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { cryptoRand, MAX_DICE, rollDie } from "./crawl";
import { errorMessage, notify } from "./utils";

export type RollTarget = "everyone" | "self" | "dm" | "gm_only";
export type DiceRequest = { count: number; sides: number; label: string; target: RollTarget };

export const READY_CHANNEL = "dice-plus/isReady";
export const REQUEST_CHANNEL = "dice-plus/roll-request";
export const RESULT_CHANNEL = `${ID}/roll-result`;
export const ERROR_CHANNEL = `${ID}/roll-error`;
// Flip here if the room test says Dice+ wants ALL.
const DESTINATION = "LOCAL" as const;
export const READY_MS = 1000;
export const RESULT_MS = 15000;

let enabled = true;
let found = false;
let checking: Promise<boolean> | null = null;
// Bumped by a reset, so an old check's answer can't land after it.
let generation = 0;

// From the room settings (Tracker and Settings keep it current).
export const setDicePlusEnabled = (on: boolean) => {
  enabled = on;
  if (on) void checkDicePlus();
};

// Rolls go to Dice+ right now (known, not guessed).
export const dicePlusActive = () => enabled && found;

// Ask Dice+ if it's there; one question at a time.
export const checkDicePlus = (): Promise<boolean> => {
  if (checking) return checking;
  const gen = generation;
  checking = new Promise<boolean>((resolve) => {
    const requestId = crypto.randomUUID();
    let off = () => {};
    const done = (ok: boolean) => {
      clearTimeout(timer);
      off();
      if (gen === generation) {
        found = ok;
        checking = null;
      }
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), READY_MS);
    off = OBR.broadcast.onMessage(READY_CHANNEL, ({ data }) => {
      const d = data as { requestId?: unknown; ready?: unknown } | null;
      if (d?.requestId === requestId && d.ready === true) done(true);
    });
    OBR.broadcast.sendMessage(READY_CHANNEL, { requestId, timestamp: Date.now() }, { destination: DESTINATION }).catch(() => done(false));
  });
  return checking;
};

const local = ({ count, sides }: DiceRequest) => Array.from({ length: count }, () => rollDie(sides, cryptoRand));

// Untrusted: the kept dice of `rollId`'s result, in order; null if it's
// that roll but malformed; undefined if it's another roll's.
export const parseResult = (data: unknown, rollId: string, req: Pick<DiceRequest, "count" | "sides">, anyCount = false): number[] | null | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const d = data as { rollId?: unknown; result?: { groups?: unknown } };
  if (d.rollId !== rollId) return undefined;
  const groups = d.result?.groups;
  if (!Array.isArray(groups)) return null;
  const values: number[] = [];
  for (const g of groups) {
    const dice = (g as { dice?: unknown; isCondensed?: unknown })?.dice;
    if ((g as { isCondensed?: unknown }).isCondensed === true || !Array.isArray(dice)) return null;
    for (const die of dice) {
      const { value, kept } = (die ?? {}) as { value?: unknown; kept?: unknown };
      if (kept === false) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > req.sides) return null;
      values.push(value);
    }
  }
  return anyCount || values.length === req.count ? values : null;
};

// One request to Dice+: the dice, or null with why (an error, a garbled
// result, no answer in 15 s). A late answer is ignored.
const ask = async (
  notation: string,
  target: RollTarget,
  read: (data: unknown, rollId: string) => number[] | null | undefined,
): Promise<{ values: number[] } | { why: string }> => {
  const playerName = await OBR.player.getName().catch(() => "GM");
  return new Promise((resolve) => {
    const rollId = crypto.randomUUID();
    let settled = false;
    const offs: (() => void)[] = [];
    const finish = (r: { values: number[] } | { why: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      offs.forEach((off) => off());
      resolve(r);
    };
    const timer = setTimeout(() => {
      found = false;
      finish({ why: "no answer" });
    }, RESULT_MS);
    offs.push(
      OBR.broadcast.onMessage(RESULT_CHANNEL, ({ data }) => {
        const values = read(data, rollId);
        if (values !== undefined) finish(values ? { values } : { why: "a result it couldn't read" });
      }),
      OBR.broadcast.onMessage(ERROR_CHANNEL, ({ data }) => {
        const d = data as { rollId?: unknown; error?: unknown } | null;
        if (d?.rollId === rollId) finish({ why: typeof d.error === "string" ? d.error.slice(0, 120) : "an error" });
      }),
    );
    OBR.broadcast
      .sendMessage(
        REQUEST_CHANNEL,
        { rollId, playerId: OBR.player.id, playerName, rollTarget: target, diceNotation: notation, showResults: true, timestamp: Date.now(), source: ID },
        { destination: DESTINATION },
      )
      .catch((err) => finish({ why: errorMessage(err) }));
  });
};

// The dice, from Dice+ when it's on and found, else here. Never rejects:
// Dice+ failing rolls here and says so.
export const rollDice = async (req: DiceRequest): Promise<number[]> => {
  if (!dicePlusActive()) {
    if (enabled) void checkDicePlus();
    return local(req);
  }
  const r = await ask(`${req.count}d${req.sides} # ${req.label}`, req.target, (data, rollId) => parseResult(data, rollId, req));
  if ("values" in r) return r.values;
  notify(`Dice+ didn't roll ${req.label} (${r.why}): rolled here instead.`, "WARNING");
  return local(req);
};

// Untrusted: an exploding roll's dice (every die but the last on the top
// face, up to MAX_DICE); null if it isn't one.
export const parseExploding = (data: unknown, rollId: string, sides: number): number[] | null | undefined => {
  const values = parseResult(data, rollId, { count: -1, sides }, true);
  if (!values) return values;
  const ok = values.length >= 1 && values.length <= MAX_DICE && values.slice(0, -1).every((v) => v === sides) && (values[values.length - 1] < sides || values.length === MAX_DICE);
  return ok ? values : null;
};

// Does Dice+ take "1d6!" (an exploding die, one roll on the table)? Unknown
// until tried; if not, one die at a time from then on.
let explodes: boolean | null = null;

// The crawling die explodes on its top face (rollClock, crawl.ts).
export const rollExploding = async (sides: number, label: string, target: RollTarget): Promise<number[]> => {
  if (dicePlusActive() && explodes !== false) {
    const r = await ask(`1d${sides}! # ${label}`, target, (data, rollId) => parseExploding(data, rollId, sides));
    if ("values" in r) {
      explodes = true;
      return r.values;
    }
    if (r.why === "no answer") {
      notify(`Dice+ didn't roll ${label} (no answer): rolled here instead.`, "WARNING");
      return explodeHere(sides);
    }
    explodes = false;
  }
  const dice: number[] = [];
  do dice.push((await rollDice({ count: 1, sides, label, target }))[0]);
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE);
  return dice;
};

const explodeHere = (sides: number) => {
  const dice = [rollDie(sides, cryptoRand)];
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE) dice.push(rollDie(sides, cryptoRand));
  return dice;
};

// Tests only: forget what's known.
export const resetDiceRoller = () => {
  generation++;
  explodes = null;
  enabled = true;
  found = false;
  checking = null;
};
