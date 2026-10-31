// The party's minimum light on the map: 3 ft of dim light on each of their
// tokens that has no light of its own, always (Matt, 2026-10-31), so
// players see their own tokens through Dynamic Fog, dark or not. And,
// until the Torchlight merge's last PR, which tokens Torchlight lights (its
// flame on the row; its lit tokens keep their own light).
//
// The contract with Torchlight is one item metadata key: its GM background
// sets TORCHLIGHT_TOKEN_KEY ({ source, saved }) on a token while a light of
// its burns there, and deletes it when the light stops (burns out, is put
// out, is swapped). Pause all leaves it set (a table break). It's Torchlight's
// TOKEN_KEY in src/tokenSync.ts: keep the two in step.
import OBR, { type Item, type Metadata } from "@owlbear-rodeo/sdk";

import { ID, TRACKER_KEY } from "./constants";
import { isObject } from "./parse";
import { parseTracker, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

export const TORCHLIGHT_TOKEN_KEY = "io.github.mattrogers13.torchlight/token";
// Dynamic Fog's light on a token (github.com/owlbear-rodeo/dynamic-fog).
export const DF_LIGHT_KEY = "rodeo.owlbear.dynamic-fog/light";
// On a token we gave the dim light: it's ours to take off again.
export const DIM_KEY = `${ID}/dim`;
// Feet of dim light around each of the party's tokens without a light.
export const DIM_FT = 3;

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

// Dynamic Fog's light shape (full circle, primary), as Torchlight writes it.
export const dimLight = (radiusPx: number) => ({
  attenuationRadius: radiusPx,
  sourceRadius: 25,
  falloff: 0.2,
  innerAngle: 360,
  outerAngle: 360,
  lightType: "PRIMARY" as const,
});

// Feet to scene pixels. Shadowdark maps are 5 ft squares; a grid whose unit
// isn't feet is treated as 5 ft per cell (as Torchlight does).
export const feetToPx = (feet: number, dpi: number, unit: string, multiplier: number) =>
  (feet / (unit === "ft" && multiplier > 0 ? multiplier : 5)) * dpi;

const sameLight = (a: unknown, radiusPx: number) =>
  isObject(a) && a.attenuationRadius === radiusPx && a.lightType === "PRIMARY" && a.innerAngle === 360;

// Pure: which tokens get the dim light and which lose it. Each of the
// party's tokens (tracked, not a monster, not dead) on the character layer
// that has no light at all gets one. Ours come off when the token stops
// qualifying; one Torchlight has lit over (it keeps ours to put back) is
// left to Torchlight until its light stops. A light someone else changed is
// theirs: we only drop our mark.
export const planDim = (t: Tracker, items: Item[], radiusPx: number) => {
  const party = new Set(t.entries.filter((e) => !e.monster && !e.dead).map((e) => e.id));
  const add: string[] = [];
  const remove: string[] = [];
  const forget: string[] = [];
  for (const i of items) {
    if (i.type !== "IMAGE" || i.layer !== "CHARACTER") continue;
    const ours = i.metadata[DIM_KEY] === true;
    const want = party.has(i.id);
    if (lightOn(i) !== null) continue;
    if (want && !ours && i.metadata[DF_LIGHT_KEY] === undefined) add.push(i.id);
    else if (!want && ours) (sameLight(i.metadata[DF_LIGHT_KEY], radiusPx) ? remove : forget).push(i.id);
  }
  return { add, remove, forget };
};

// The GM's background: the 3 ft dim light on the party's tokens, kept in
// step as tokens and rows change. One sync at a time.
export const watchDimLights = () => {
  let gm = false;
  let running: Promise<void> = Promise.resolve();
  const sync = () => {
    running = running.then(syncOnce).catch((err) => notify(`Couldn't update the party's light: ${errorMessage(err)}`, "WARNING"));
  };
  const syncOnce = async () => {
    if (!gm || !(await OBR.scene.isReady())) return;
    const [items, scene] = await Promise.all([OBR.scene.items.getItems(), OBR.scene.getMetadata()]);
    await syncDim(parseTracker(scene[TRACKER_KEY]), items);
  };
  const role = (r: string) => {
    gm = r === "GM";
    sync();
  };
  OBR.player
    .getRole()
    .then(role)
    .catch((err) => console.warn(`Couldn't read the role: ${errorMessage(err)}`));
  const offPlayer = OBR.player.onChange((p) => role(p.role));
  const offItems = OBR.scene.items.onChange(() => sync());
  const offScene = OBR.scene.onMetadataChange((m: Metadata) => m[TRACKER_KEY] !== undefined && sync());
  const offReady = OBR.scene.onReadyChange(() => sync());
  return () => {
    offPlayer();
    offItems();
    offScene();
    offReady();
  };
};

const syncDim = async (t: Tracker, items: Item[]) => {
  const [dpi, scale] = await Promise.all([OBR.scene.grid.getDpi(), OBR.scene.grid.getScale()]);
  const radius = feetToPx(DIM_FT, dpi, scale.parsed.unit, scale.parsed.multiplier);
  const plan = planDim(t, items, radius);
  const ids = [...plan.add, ...plan.remove, ...plan.forget];
  if (ids.length === 0) return;
  const add = new Set(plan.add);
  const remove = new Set(plan.remove);
  await OBR.scene.items.updateItems(ids, (drafts) => {
    for (const d of drafts) {
      if (add.has(d.id)) {
        d.metadata[DF_LIGHT_KEY] = dimLight(radius);
        d.metadata[DIM_KEY] = true;
        continue;
      }
      if (remove.has(d.id)) delete d.metadata[DF_LIGHT_KEY];
      delete d.metadata[DIM_KEY];
    }
  });
};
