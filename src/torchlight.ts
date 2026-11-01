// Until the Torchlight merge's last PR: which tokens Torchlight lights (its
// flame on the row; tokenLights.ts leaves its lit tokens alone).
//
// The contract with Torchlight is one item metadata key: its GM background
// sets TORCHLIGHT_TOKEN_KEY ({ source, saved }) on a token while a light of
// its burns there, and deletes it when the light stops (burns out, is put
// out, is swapped). Pause all leaves it set (a table break). It's Torchlight's
// TOKEN_KEY in src/tokenSync.ts: keep the two in step.
import type { Item } from "@owlbear-rodeo/sdk";

import { isObject } from "./parse";

export const TORCHLIGHT_TOKEN_KEY = "io.github.mattrogers13.torchlight/token";
export type LightSource = "torch" | "lantern" | "light-spell";
const SOURCES: LightSource[] = ["torch", "lantern", "light-spell"];
export const SOURCE_LABEL: Record<LightSource, string> = { torch: "Torch", lantern: "Lantern", "light-spell": "Light spell" };

// The light Torchlight has burning on this token, if any. Item metadata is
// untrusted: an unknown source still counts as a light.
export const lightOn = (item: Item | undefined): LightSource | null => {
  const raw = item?.metadata[TORCHLIGHT_TOKEN_KEY];
  if (raw === undefined) return null;
  const source = isObject(raw) ? raw.source : undefined;
  return SOURCES.includes(source as LightSource) ? (source as LightSource) : "torch";
};
