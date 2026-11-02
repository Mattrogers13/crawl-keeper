// Lights on the map (docs/design.md, Torchlight merge; Torchlight's
// tokenSync). The GM's background page keeps each token's Dynamic Fog light
// in step with the Light Tracker:
//
// - A token holding a lit light gets that light's range (near 30 ft, a
//   lantern double near, 60 ft; p. 34). The light it had before is saved on
//   the token and comes back when ours stops (put out, spent, removed).
// - Otherwise each of the party's tokens (tracked, not a monster, not dead,
//   character layer) with no light of its own gets 3 ft of dim light, always
//   (Matt, 2026-10-31: "When a token doesn't have a torch it should be 3ft
//   min"), so players see their own tokens through the fog.
//
// - A carried light (torch, lantern, Light spell) also gets a badge on the
//   token, its icon at the top right. A campfire is a stationary light: no
//   badge (the fire is the token) and never a row in the initiative list.
//
// Paused lights still shine (a table break). Burn-outs need no write: a
// timer re-syncs when the next light runs out.
import OBR, { buildImage, type Image, type Item, type Metadata } from "@owlbear-rodeo/sdk";

import { BADGE_KEY, ID, LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { isOurBadge, tokenCells } from "./marker";
import { msToNextBurnOut, parseLights, shining, type LightKind, type Lights } from "./lights";
import { isObject } from "./parse";
import { parseTracker, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

// Dynamic Fog's light on a token (github.com/owlbear-rodeo/dynamic-fog).
export const DF_LIGHT_KEY = "rodeo.owlbear.dynamic-fog/light";
// On a token we gave the 3 ft light: it's ours to take off again.
export const DIM_KEY = `${ID}/dim`;
// On a token we lit: the light it had before (null = none) and our kind.
export const LIT_KEY = `${ID}/lit`;
// Feet of dim light around each of the party's tokens without a light.
export const DIM_FT = 3;
export const RANGE_FT: Record<LightKind, number> = { torch: 30, lantern: 60, lightSpell: 30, campfire: 30 };

// Dynamic Fog's light shape: full circle, primary, a solid edge; the source
// radius fits through a 5 ft door (Torchlight's values).
export const dfLight = (radiusPx: number) => ({
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

// Token metadata is editable by anyone who can edit the token: only known
// Dynamic Fog fields survive the save and restore.
const DF_NUMBERS = ["attenuationRadius", "sourceRadius", "falloff", "innerAngle", "outerAngle", "rotation"];
export const parseDfLight = (v: unknown): Record<string, unknown> | null => {
  if (!isObject(v)) return null;
  const out: Record<string, unknown> = {};
  for (const key of DF_NUMBERS) if (typeof v[key] === "number" && Number.isFinite(v[key])) out[key] = v[key];
  if (v.lightType === "PRIMARY" || v.lightType === "SECONDARY") out.lightType = v.lightType;
  return Object.keys(out).length > 0 ? out : null;
};

export type LitMark = { saved: Record<string, unknown> | null; kind: LightKind };
const parseMark = (v: unknown): LitMark | null =>
  isObject(v) && typeof v.kind === "string" && v.kind in RANGE_FT ? { saved: parseDfLight(v.saved), kind: v.kind as LightKind } : null;

// What to write on one token. `light`: the Dynamic Fog light to set (null
// deletes it); `lit`: our mark (null deletes it); `dim`: set or drop the 3 ft
// mark. A field left out stays as it is.
export type TokenChange = { id: string; light?: unknown; lit?: LitMark | null; dim?: boolean };

// Pure: the changes that bring the map in line. `px` turns feet into this
// map's pixels.
export const planTokenLights = (t: Tracker, items: Item[], s: Lights, now: number, px: (ft: number) => number): TokenChange[] => {
  const party = new Set(t.entries.filter((e) => !e.monster && !e.dead).map((e) => e.id));
  const lit = new Map<string, LightKind>();
  for (const l of s.lights) if (shining(l, now)) lit.set(l.tokenId, l.kind);
  const dimPx = px(DIM_FT);
  const changes: TokenChange[] = [];
  for (const i of items) {
    if (i.type !== "IMAGE") continue;
    const df = i.metadata[DF_LIGHT_KEY];
    const mark = parseMark(i.metadata[LIT_KEY]);
    const ourDim = i.metadata[DIM_KEY] === true;
    const kind = lit.get(i.id);
    if (kind) {
      const radius = px(RANGE_FT[kind]);
      if (mark && mark.kind === kind && sameLight(df, radius)) continue;
      // Our 3 ft light isn't the token's own: nothing to put back.
      const saved = mark ? mark.saved : ourDim ? null : parseDfLight(df);
      changes.push({ id: i.id, light: dfLight(radius), lit: { saved, kind }, ...(ourDim ? { dim: false } : {}) });
      continue;
    }
    const wantDim = party.has(i.id) && i.layer === "CHARACTER";
    if (mark) {
      // Ours stopped: the token's own light back, else the 3 ft minimum.
      if (mark.saved) changes.push({ id: i.id, light: mark.saved, lit: null });
      else if (wantDim) changes.push({ id: i.id, light: dfLight(dimPx), lit: null, dim: true });
      else changes.push({ id: i.id, light: null, lit: null });
      continue;
    }
    if (wantDim && !ourDim && df === undefined) changes.push({ id: i.id, light: dfLight(dimPx), dim: true });
    // No longer one of the party: ours comes off; a light someone else
    // changed is theirs, we only drop our mark.
    else if (!wantDim && ourDim) changes.push({ id: i.id, ...(sameLight(df, dimPx) ? { light: null } : {}), dim: false });
  }
  return changes;
};

// WebP, never SVG on the map (black square). Sources: art/badges/*.svg.
const BADGE_FILE: Partial<Record<LightKind, string>> = { torch: "torch", lantern: "lantern", lightSpell: "light-spell" };
export const badgeImage = (kind: LightKind) => {
  const file = BADGE_FILE[kind];
  return file ? `${window.location.origin}/img/badge-${file}.webp` : null;
};

export type BadgeState = { id: string; attachedTo: string | undefined; image: string | undefined; visible: boolean };

// Pure: one up-to-date badge per token holding a shining carried light
// (current art, the token's visibility); anything else goes: strays,
// duplicates, the wrong light, old art.
export const planBadges = (badges: BadgeState[], items: Item[], s: Lights, now: number) => {
  const want = new Map<string, { image: string; visible: boolean }>();
  const present = new Map(items.map((i) => [i.id, i]));
  for (const l of s.lights) {
    const image = badgeImage(l.kind);
    const token = present.get(l.tokenId);
    if (image && token && token.type === "IMAGE" && shining(l, now)) want.set(l.tokenId, { image, visible: token.visible });
  }
  const kept = new Set<string>();
  const remove: string[] = [];
  for (const b of badges) {
    const on = b.attachedTo;
    const w = on === undefined ? undefined : want.get(on);
    if (on !== undefined && w && !kept.has(on) && b.image === w.image && b.visible === w.visible) kept.add(on);
    else remove.push(b.id);
  }
  return { remove, add: [...want].filter(([id]) => !kept.has(id)).map(([tokenId, w]) => ({ tokenId, image: w.image })) };
};

// A third of the token's width, at its top right; it follows the token.
const BADGE_PX = 128;
export const buildBadge = (token: Image, image: string, sceneDpi: number) => {
  const cells = tokenCells(token);
  const size = 0.35 * cells;
  const offset = (cells * sceneDpi) / 2 - (size * sceneDpi) / 2;
  return buildImage(
    { width: BADGE_PX, height: BADGE_PX, mime: "image/webp", url: image },
    { dpi: BADGE_PX / size, offset: { x: BADGE_PX / 2, y: BADGE_PX / 2 } },
  )
    .name("Light (Crawl Keeper)")
    .position({ x: token.position.x + offset, y: token.position.y - offset })
    .attachedTo(token.id)
    .visible(token.visible)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["ROTATION", "COPY"])
    .metadata({ [BADGE_KEY]: true })
    .build();
};

const syncBadges = async (items: Item[], s: Lights, now: number, sceneDpi: number) => {
  const badges = items.filter(isOurBadge);
  const plan = planBadges(
    badges.map((b) => ({ id: b.id, attachedTo: b.attachedTo, image: b.image?.url, visible: b.visible })),
    items,
    s,
    now,
  );
  if (plan.remove.length > 0) await OBR.scene.items.deleteItems(plan.remove);
  const byId = new Map(items.map((i) => [i.id, i]));
  if (plan.add.length > 0) await OBR.scene.items.addItems(plan.add.map((a) => buildBadge(byId.get(a.tokenId) as Image, a.image, sceneDpi)));
};

// The GM's background: keeps the map in step on every change to the
// tokens, the list or the lights, and when the next light burns out. One
// sync at a time.
export const watchTokenLights = () => {
  let gm = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();
  const sync = () => {
    running = running.then(syncOnce).catch((err) => notify(`Couldn't update the lights on the map: ${errorMessage(err)}`, "WARNING"));
  };
  const syncOnce = async () => {
    clearTimeout(timer);
    if (!gm || !(await OBR.scene.isReady())) return;
    const [items, scene, room, dpi, scale] = await Promise.all([
      OBR.scene.items.getItems(),
      OBR.scene.getMetadata(),
      OBR.room.getMetadata(),
      OBR.scene.grid.getDpi(),
      OBR.scene.grid.getScale(),
    ]);
    const lights = parseLights(room[LIGHTS_KEY]);
    const now = Date.now();
    const px = (ft: number) => feetToPx(ft, dpi, scale.parsed.unit, scale.parsed.multiplier);
    await write(planTokenLights(parseTracker(scene[TRACKER_KEY]), items, lights, now, px));
    await syncBadges(items, lights, now, dpi);
    const next = msToNextBurnOut(lights, now);
    if (next !== null) timer = setTimeout(sync, next + 50);
  };
  const role = (r: string) => {
    gm = r === "GM";
    sync();
  };
  OBR.player
    .getRole()
    .then(role)
    .catch((err) => console.warn(`Couldn't read the role: ${errorMessage(err)}`));
  // Room metadata is shared by every extension: only our lights matter.
  let lastLights: string | undefined;
  const offRoom = OBR.room.onMetadataChange((m: Metadata) => {
    const raw = JSON.stringify(m[LIGHTS_KEY]);
    if (raw === lastLights) return;
    lastLights = raw;
    sync();
  });
  const offPlayer = OBR.player.onChange((p) => role(p.role));
  const offItems = OBR.scene.items.onChange(() => sync());
  const offScene = OBR.scene.onMetadataChange((m: Metadata) => m[TRACKER_KEY] !== undefined && sync());
  const offReady = OBR.scene.onReadyChange(() => sync());
  const offGrid = OBR.scene.grid.onChange(() => sync());
  return () => {
    clearTimeout(timer);
    offRoom();
    offPlayer();
    offItems();
    offScene();
    offReady();
    offGrid();
  };
};

const write = async (changes: TokenChange[]) => {
  if (changes.length === 0) return;
  const byId = new Map(changes.map((c) => [c.id, c]));
  await OBR.scene.items.updateItems([...byId.keys()], (drafts) => {
    for (const d of drafts) {
      const c = byId.get(d.id)!;
      if (c.light === null) delete d.metadata[DF_LIGHT_KEY];
      else if (c.light !== undefined) d.metadata[DF_LIGHT_KEY] = c.light;
      if (c.lit === null) delete d.metadata[LIT_KEY];
      else if (c.lit !== undefined) d.metadata[LIT_KEY] = c.lit;
      if (c.dim === true) d.metadata[DIM_KEY] = true;
      else if (c.dim === false) delete d.metadata[DIM_KEY];
    }
  });
};
