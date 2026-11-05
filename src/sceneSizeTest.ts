import OBR from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { errorMessage } from "./utils";

// Dev-only (Settings, v0.4 build step 1, docs/effects.md): how much scene
// metadata Owlbear accepts. The room's 16 kB cap is documented; the scene's
// isn't. Writes a test key of growing size to the open scene, reads it back,
// deletes it, and stops at the first size that fails. Sizes are the whole
// scene (every extension's keys plus the test key), as Owlbear would count.

export const SIZE_TEST_KEY = `${ID}/size-test`;
// Test key payloads, in kB. 15 under a 16 kB cap with nothing else stored;
// the larger steps tell "16 kB like rooms" from "bigger" from "no cap seen".
export const STEPS_KB = [15, 20, 32, 64];

export type StepResult = { keyKB: number; totalKB: number; ok: boolean; error?: string };
// deleted: whether `undefined` removed the key (docs/obr/gotchas.md marks it
// unverified); if not, the key is shrunk to null so it doesn't sit there.
export type SizeTestResult = { beforeKB: number; steps: StepResult[]; deleted?: boolean; cleanupError?: string };

const bytes = (value: unknown) => new Blob([JSON.stringify(value) ?? ""]).size;
const kB = (n: number) => Math.round(n / 100) / 10;

export const runSceneSizeTest = async (): Promise<SizeTestResult> => {
  const before = await OBR.scene.getMetadata();
  const { [SIZE_TEST_KEY]: _, ...others } = before;
  const beforeKB = kB(bytes(others));
  const steps: StepResult[] = [];
  let deleted: boolean | undefined;
  let cleanupError: string | undefined;
  try {
    for (const keyKB of STEPS_KB) {
      const payload = "x".repeat(keyKB * 1000);
      const totalKB = kB(bytes({ ...others, [SIZE_TEST_KEY]: payload }));
      try {
        await OBR.scene.setMetadata({ [SIZE_TEST_KEY]: payload });
        const back = (await OBR.scene.getMetadata())[SIZE_TEST_KEY];
        if (back !== payload) {
          steps.push({ keyKB, totalKB, ok: false, error: "read back differs" });
          break;
        }
        steps.push({ keyKB, totalKB, ok: true });
      } catch (err) {
        steps.push({ keyKB, totalKB, ok: false, error: errorMessage(err) });
        break;
      }
    }
  } finally {
    // Always delete the test key, even after a failure.
    try {
      await OBR.scene.setMetadata({ [SIZE_TEST_KEY]: undefined });
      deleted = (await OBR.scene.getMetadata())[SIZE_TEST_KEY] === undefined;
      if (!deleted) await OBR.scene.setMetadata({ [SIZE_TEST_KEY]: null });
    } catch (err) {
      cleanupError = errorMessage(err);
    }
  }
  return { beforeKB, steps, deleted, cleanupError };
};

export const describeResult = ({ beforeKB, steps, deleted, cleanupError }: SizeTestResult): string => {
  const passed = steps.filter((s) => s.ok);
  const failed = steps.find((s) => !s.ok);
  const lines = [`Scene before: ${beforeKB} kB.`];
  lines.push(
    passed.length
      ? `Accepted up to ${passed[passed.length - 1].totalKB} kB total.`
      : "No size was accepted.",
  );
  if (failed) lines.push(`Rejected at ${failed.totalKB} kB total: ${failed.error}.`);
  else lines.push("No cap reached.");
  lines.push(
    cleanupError
      ? `Couldn't clean up the test key: ${cleanupError}. Run it again.`
      : deleted
        ? "Test key deleted (undefined deletes)."
        : "undefined didn't delete the key; it's set to null now.",
  );
  return lines.join(" ");
};
