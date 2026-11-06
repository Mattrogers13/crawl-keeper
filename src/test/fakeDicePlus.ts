// A stand-in for the Dice+ extension on the mock broadcast: answers the
// ready check, and rolls with the values given (in order), or errors.
import { vi } from "vitest";

import OBR from "@owlbear-rodeo/sdk";

import { ERROR_CHANNEL, READY_CHANNEL, REQUEST_CHANNEL, RESULT_CHANNEL } from "../diceRoller";
import { obr } from "./obrMock";

const emit = (channel: string, data: unknown) => (obr.broadcastListeners.get(channel) ?? []).forEach((l) => l({ data, connectionId: obr.connectionId }));

export type Answer = number[] | "error" | "silent" | { garbled: unknown };

export const fakeDicePlus = (answers: Answer[] = []) => {
  const requests: Record<string, unknown>[] = [];
  vi.mocked(OBR.broadcast.sendMessage).mockImplementation(async (channel: string, data: unknown) => {
    const d = data as Record<string, unknown>;
    if (channel === READY_CHANNEL && d.ready !== true) queueMicrotask(() => emit(READY_CHANNEL, { requestId: d.requestId, ready: true, timestamp: Date.now() }));
    if (channel === REQUEST_CHANNEL) {
      requests.push(d);
      const answer = answers.shift() ?? "silent";
      queueMicrotask(() => {
        if (answer === "silent") return;
        if (answer === "error") return emit(ERROR_CHANNEL, { rollId: d.rollId, error: "Bad notation", notation: d.diceNotation });
        if (!Array.isArray(answer)) return emit(RESULT_CHANNEL, { rollId: d.rollId, result: answer.garbled });
        emit(RESULT_CHANNEL, {
          rollId: d.rollId,
          playerId: d.playerId,
          result: { rollId: d.rollId, totalValue: answer.reduce((a, b) => a + b, 0), groups: [{ diceType: "d", dice: answer.map((value) => ({ value, kept: true })), total: 0 }] },
        });
      });
    }
  });
  return requests;
};
