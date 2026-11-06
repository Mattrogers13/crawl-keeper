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
export const parseResult = (data: unknown, rollId: string, req: Pick<DiceRequest, "count" | "sides">): number[] | null | undefined => {
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
  return values.length === req.count ? values : null;
};

// The dice, from Dice+ when it's on and found, else here. Never rejects:
// Dice+ failing (an error, no answer in 15 s, a garbled result) rolls here
// and says so. A late answer is ignored.
export const rollDice = async (req: DiceRequest): Promise<number[]> => {
  if (!dicePlusActive()) {
    if (enabled) void checkDicePlus();
    return local(req);
  }
  const playerName = await OBR.player.getName().catch(() => "GM");
  return new Promise<number[]>((resolve) => {
    const rollId = crypto.randomUUID();
    let settled = false;
    const offs: (() => void)[] = [];
    const finish = (values: number[] | null, why = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      offs.forEach((off) => off());
      if (values) return resolve(values);
      notify(`Dice+ didn't roll ${req.label}${why ? ` (${why})` : ""}: rolled here instead.`, "WARNING");
      resolve(local(req));
    };
    const timer = setTimeout(() => {
      found = false;
      finish(null, "no answer");
    }, RESULT_MS);
    offs.push(
      OBR.broadcast.onMessage(RESULT_CHANNEL, ({ data }) => {
        const values = parseResult(data, rollId, req);
        if (values !== undefined) finish(values, "a result it couldn't read");
      }),
      OBR.broadcast.onMessage(ERROR_CHANNEL, ({ data }) => {
        const d = data as { rollId?: unknown; error?: unknown } | null;
        if (d?.rollId === rollId) finish(null, typeof d.error === "string" ? d.error.slice(0, 120) : "an error");
      }),
    );
    OBR.broadcast
      .sendMessage(
        REQUEST_CHANNEL,
        {
          rollId,
          playerId: OBR.player.id,
          playerName,
          rollTarget: req.target,
          diceNotation: `${req.count}d${req.sides} # ${req.label}`,
          showResults: true,
          timestamp: Date.now(),
          source: ID,
        },
        { destination: DESTINATION },
      )
      .catch((err) => finish(null, errorMessage(err)));
  });
};

// The crawling die explodes on its top face (rollClock, crawl.ts): one die
// at a time, again on a max, up to MAX_DICE.
export const rollExploding = async (sides: number, label: string, target: RollTarget): Promise<number[]> => {
  const dice: number[] = [];
  do dice.push((await rollDice({ count: 1, sides, label, target }))[0]);
  while (dice[dice.length - 1] === sides && dice.length < MAX_DICE);
  return dice;
};

// Tests only: forget what's known.
export const resetDiceRoller = () => {
  generation++;
  enabled = true;
  found = false;
  checking = null;
};
