// Following Torchlight (github.com/Mattrogers13/obr-torchlight): which
// tracked tokens carry a burning light, total darkness when the last one goes
// out, and a dim light on the party's tokens while it's dark so players still
// see their own tokens through Dynamic Fog.
//
// The contract with Torchlight is one item metadata key: its GM background
// sets TORCHLIGHT_TOKEN_KEY ({ source, saved }) on a token while a light of
// its burns there, and deletes it when the light stops (burns out, is put
// out, is swapped). Pause all leaves it set (a table break). It's Torchlight's
// TOKEN_KEY in src/tokenSync.ts: keep the two in step.
import OBR, { type Item, type Metadata } from "@owlbear-rodeo/sdk";

import { ID, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { lightsBack, lightsOut } from "./crawl";
import { isObject } from "./parse";
import { parseSettings } from "./settings";
import { parseTracker, updateCrawl, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

export const TORCHLIGHT_TOKEN_KEY = "io.github.mattrogers13.torchlight/token";
// Dynamic Fog's light on a token (github.com/owlbear-rodeo/dynamic-fog).
export const DF_LIGHT_KEY = "rodeo.owlbear.dynamic-fog/light";
// On a token we gave the dim light: it's ours to take off again.
export const DIM_KEY = `${ID}/dim`;
// Feet of dim light around each of the party's tokens in total darkness.
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

// Is any tracked token lit?
export const anyLit = (t: Tracker, items: Item[]) => {
  const tracked = new Set(t.entries.map((e) => e.id));
  return items.some((i) => tracked.has(i.id) && lightOn(i) !== null);
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

// Pure: which tokens get the dim light and which lose it. While it's dark,
// each of the party's tokens (tracked, not a monster, not dead) on the
// character layer that has no light at all gets one. Ours come off when it's
// light again, or when the token stops qualifying; one Torchlight has lit
// over (it keeps ours to put back) is left to Torchlight until its light
// stops. A light someone else changed is theirs: we only drop our mark.
export const planDim = (t: Tracker, items: Item[], dark: boolean, radiusPx: number) => {
  const party = new Set(t.entries.filter((e) => !e.monster && !e.dead).map((e) => e.id));
  const add: string[] = [];
  const remove: string[] = [];
  const forget: string[] = [];
  for (const i of items) {
    if (i.type !== "IMAGE" || i.layer !== "CHARACTER") continue;
    const ours = i.metadata[DIM_KEY] === true;
    const want = dark && party.has(i.id);
    if (lightOn(i) !== null) continue;
    if (want && !ours && i.metadata[DF_LIGHT_KEY] === undefined) add.push(i.id);
    else if (!want && ours) (sameLight(i.metadata[DF_LIGHT_KEY], radiusPx) ? remove : forget).push(i.id);
  }
  return { add, remove, forget };
};

// The GM's background: follows Torchlight while the setting is on. Darkness
// and Deadly change only when the lit state changes (the last light out, the
// first one back), never from what's there when it starts, so a room without
// Torchlight is never plunged into darkness. One sync at a time.
export const watchTorchlight = () => {
  let gm = false;
  let lit: boolean | null = null;
  let running: Promise<void> = Promise.resolve();
  const sync = () => {
    running = running.then(syncOnce).catch((err) => notify(`Couldn't follow Torchlight: ${errorMessage(err)}`, "WARNING"));
  };
  const syncOnce = async () => {
    if (!gm || !(await OBR.scene.isReady())) return;
    const [items, scene, room] = await Promise.all([OBR.scene.items.getItems(), OBR.scene.getMetadata(), OBR.room.getMetadata()]);
    if (!parseSettings(room[SETTINGS_KEY]).followTorchlight) {
      lit = null;
      return syncDim(parseTracker(scene[TRACKER_KEY]), items, false);
    }
    let t = parseTracker(scene[TRACKER_KEY]);
    const now = anyLit(t, items);
    if (lit !== null && now !== lit) {
      const updated = updateCrawl(t, now ? lightsBack : lightsOut);
      if (updated !== t) await OBR.scene.setMetadata({ [TRACKER_KEY]: updated });
      t = updated;
    }
    lit = now;
    await syncDim(t, items, t.crawl.dark);
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
  const offRoom = OBR.room.onMetadataChange(() => sync());
  const offReady = OBR.scene.onReadyChange(() => {
    lit = null;
    sync();
  });
  return () => {
    offPlayer();
    offItems();
    offScene();
    offRoom();
    offReady();
  };
};

const syncDim = async (t: Tracker, items: Item[], dark: boolean) => {
  const [dpi, scale] = await Promise.all([OBR.scene.grid.getDpi(), OBR.scene.grid.getScale()]);
  const radius = feetToPx(DIM_FT, dpi, scale.parsed.unit, scale.parsed.multiplier);
  const plan = planDim(t, items, dark, radius);
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
