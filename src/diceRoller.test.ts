import { describe, expect, it, vi } from "vitest";

import OBR from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { replayRand, rollClock, emptyCrawl } from "./crawl";
import { checkDicePlus, dicePlusActive, parseResult, READY_CHANNEL, REQUEST_CHANNEL, RESULT_MS, rollDice, rollExploding, setDicePlusEnabled } from "./diceRoller";
import { fakeDicePlus } from "./test/fakeDicePlus";

const d6 = { count: 1, sides: 6, label: "Encounter check", target: "gm_only" as const };
const notices = () => vi.mocked(OBR.notification.show).mock.calls.map((c) => c[0]);

describe("the dice roller", () => {
  it("no Dice+: rolls here at once, and asks for Dice+ in the background", async () => {
    vi.useFakeTimers();
    try {
      const [v] = await rollDice(d6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(vi.mocked(OBR.broadcast.sendMessage).mock.calls.map((c) => [c[0], c[2]])).toEqual([[READY_CHANNEL, { destination: "LOCAL" }]]);
      await vi.advanceTimersByTimeAsync(1100);
      expect(dicePlusActive()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Dice+ found: the request it gets, and the dice from its result", async () => {
    const requests = fakeDicePlus([[4]]);
    expect(await checkDicePlus()).toBe(true);
    expect(dicePlusActive()).toBe(true);
    expect(await rollDice(d6)).toEqual([4]);
    expect(requests[0]).toMatchObject({ rollTarget: "gm_only", diceNotation: "1d6 # Encounter check", showResults: true, source: ID, playerId: "player-1" });
    const send = vi.mocked(OBR.broadcast.sendMessage).mock.calls.find((c) => c[0] === REQUEST_CHANNEL)!;
    expect(send[2]).toEqual({ destination: "LOCAL" });
  });

  it("an error, a garbled result, or no answer: rolls here and says so; a late answer is ignored", async () => {
    fakeDicePlus(["error", { garbled: { groups: [{ dice: [{ value: 9, kept: true }] }] } }]);
    await checkDicePlus();
    const [a] = await rollDice(d6);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(notices()).toEqual(["Dice+ didn't roll Encounter check (Bad notation): rolled here instead."]);
    await rollDice(d6);
    expect(notices()[1]).toMatch(/a result it couldn't read/);
    vi.useFakeTimers();
    try {
      fakeDicePlus(["silent"]);
      const late = rollDice(d6);
      await vi.advanceTimersByTimeAsync(RESULT_MS + 10);
      expect((await late)[0]).toBeGreaterThanOrEqual(1);
      expect(notices()[2]).toMatch(/no answer/);
      // Not answering counts as gone until it answers the ready check again.
      expect(dicePlusActive()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("off in Settings: never asks", async () => {
    setDicePlusEnabled(false);
    await rollDice(d6);
    expect(OBR.broadcast.sendMessage).not.toHaveBeenCalled();
  });

  it("the crawling die explodes one die at a time; replayed, the clock rules see the same dice", async () => {
    fakeDicePlus([[6], [6], [2]]);
    await checkDicePlus();
    const dice = await rollExploding(6, "Crawling die", "everyone");
    expect(dice).toEqual([6, 6, 2]);
    expect(rollClock({ ...emptyCrawl(), crawlRounds: 1 }, replayRand(dice, 6)).last).toMatchObject({ dice: [6, 6, 2], before: 20, after: 6 });
  });

  it("parses results as untrusted", () => {
    const ok = { rollId: "r", result: { groups: [{ dice: [{ value: 3, kept: true }, { value: 1, kept: false }] }] } };
    expect(parseResult(ok, "r", { count: 1, sides: 6 })).toEqual([3]);
    expect(parseResult(ok, "other", { count: 1, sides: 6 })).toBeUndefined();
    expect(parseResult({ rollId: "r", result: {} }, "r", { count: 1, sides: 6 })).toBeNull();
    expect(parseResult({ rollId: "r", result: { groups: [{ isCondensed: true, dice: [] }] } }, "r", { count: 1, sides: 6 })).toBeNull();
    expect(parseResult(ok, "r", { count: 2, sides: 6 })).toBeNull();
  });
});
