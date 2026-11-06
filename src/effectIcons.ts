// Effect icons on the map (docs/effects.md "Where it shows"). The GM's
// background page keeps each token's icons in step with the scene's effects:
// small attachments in a row along the token's bottom edge, clear of the
// turn ring, the skull (centered) and the light badge (top right).
//
// - One icon per kind on a token: Focus, then the conditions in the book's
//   order, then one asterisk for every other effect. Three at most; with
//   more, the third is "+".
// - Only effects running now (an ended one goes when its turn starts).
// - A hidden effect's icon is drawn hidden (the GM sees it faded, players
//   don't), after the shown ones so players see no gap. Hidden token: all
//   hidden.
// - Settings → Show effect icons on the map, off: none.
import OBR, { buildImage, type Image, type Item, type Metadata } from "@owlbear-rodeo/sdk";

import { EFFECTS_KEY, EFFECT_ICON_KEY, EFFECT_SLOT_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { CONDITION_IDS, hideDeath, parseEffects, statusOf, type Condition, type Effect, type Effects } from "./effects";
import { isOurEffectIcon, tokenCells } from "./marker";
import { parseSettings } from "./settings";
import { parseTracker, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

export type IconName = Condition | "custom" | "more";
const ORDER: IconName[] = [...CONDITION_IDS, "custom"];
export const MAX_ICONS = 3;

// WebP, never SVG on the map (black square). Sources: art/effects/*.svg.
export const iconImage = (name: IconName) => `${window.location.origin}/img/effect-${name}.webp`;

// An effect's icon: its condition, focus, or the asterisk for a custom one
// (the map and the panel's effect lines).
export const iconOf = (e: Effect): IconName => (e.kind === "focus" ? "focus" : (e.icon ?? "custom"));

// Pure: each token's icons, in order, and whether each is hidden from
// players (every effect behind it is hidden).
export const tokenIcons = (s: Effects, t: Tracker): Map<string, { name: IconName; hidden: boolean }[]> => {
  const byToken = new Map<string, Map<IconName, boolean>>();
  for (const e of s.effects) {
    if (e.holder === null || statusOf(e, t).state !== "active") continue;
    const name = iconOf(e);
    const icons = byToken.get(e.holder) ?? new Map<IconName, boolean>();
    icons.set(name, (icons.get(name) ?? true) && e.hidden);
    byToken.set(e.holder, icons);
  }
  const out = new Map<string, { name: IconName; hidden: boolean }[]>();
  for (const [token, icons] of byToken) {
    const list = [...icons]
      .map(([name, hidden]) => ({ name, hidden }))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
    out.set(
      token,
      list.length <= MAX_ICONS
        ? list
        : [...list.slice(0, MAX_ICONS - 1), { name: "more", hidden: list.slice(MAX_ICONS - 1).every((i) => i.hidden) }],
    );
  }
  return out;
};

export type IconState = { id: string; attachedTo: string | undefined; image: string | undefined; visible: boolean; slot: unknown };
export type WantedIcon = { tokenId: string; image: string; visible: boolean; slot: string };

// Pure: the icons to delete and to add so each token has exactly what it
// should (art, place, visibility); strays, duplicates and old art go.
export const planEffectIcons = (icons: IconState[], items: Item[], s: Effects, t: Tracker, on: boolean) => {
  const want = new Map<string, WantedIcon>();
  const present = new Map(items.map((i) => [i.id, i]));
  if (on)
    for (const [tokenId, list] of tokenIcons(s, t)) {
      const token = present.get(tokenId);
      if (!token || token.type !== "IMAGE") continue;
      list.forEach((icon, i) => {
        const slot = `${i + 1}/${list.length}`;
        want.set(`${tokenId} ${slot}`, { tokenId, image: iconImage(icon.name), visible: token.visible && !icon.hidden, slot });
      });
    }
  const kept = new Set<string>();
  const remove: string[] = [];
  for (const icon of icons) {
    const key = `${icon.attachedTo} ${icon.slot}`;
    const w = want.get(key);
    if (w && !kept.has(key) && icon.image === w.image && icon.visible === w.visible) kept.add(key);
    else remove.push(icon.id);
  }
  return { remove, add: [...want].filter(([key]) => !kept.has(key)).map(([, w]) => w) };
};

// A quarter of the token's width each, centered in a row on its bottom
// edge; it follows the token.
const ICON_PX = 128;
const ICON_SIZE = 0.25;
export const buildEffectIcon = (token: Image, want: WantedIcon, sceneDpi: number) => {
  const [n, of] = want.slot.split("/").map(Number);
  const cells = tokenCells(token);
  const size = ICON_SIZE * cells;
  const x = (n - 1 - (of - 1) / 2) * size * 1.08;
  const y = cells / 2 - size * 0.5;
  return buildImage(
    { width: ICON_PX, height: ICON_PX, mime: "image/webp", url: want.image },
    { dpi: ICON_PX / size, offset: { x: ICON_PX / 2, y: ICON_PX / 2 } },
  )
    .name("Effect (Crawl Keeper)")
    .position({ x: token.position.x + x * sceneDpi, y: token.position.y + y * sceneDpi })
    .attachedTo(token.id)
    .visible(want.visible)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["ROTATION", "COPY"])
    .metadata({ [EFFECT_ICON_KEY]: true, [EFFECT_SLOT_KEY]: want.slot })
    .build();
};

// The GM's background: keeps the map in step on every change to the tokens,
// the tracker or effects, the setting, or the grid. One sync at a time, each
// reading fresh (quick clicks race otherwise: docs/obr/gotchas.md).
export const watchEffectIcons = () => {
  let gm = false;
  let running: Promise<void> = Promise.resolve();
  const sync = () => {
    running = running.then(syncOnce).catch((err) => notify(`Couldn't update the effect icons on the map: ${errorMessage(err)}`, "WARNING"));
  };
  const syncOnce = async () => {
    if (!gm || !(await OBR.scene.isReady())) return;
    const [items, scene, room, dpi] = await Promise.all([
      OBR.scene.items.getItems(),
      OBR.scene.getMetadata(),
      OBR.room.getMetadata(),
      OBR.scene.grid.getDpi(),
    ]);
    const ours = items.filter(isOurEffectIcon);
    const plan = planEffectIcons(
      ours.map((i) => ({ id: i.id, attachedTo: i.attachedTo, image: i.image?.url, visible: i.visible, slot: i.metadata[EFFECT_SLOT_KEY] })),
      items,
      // Players don't see Dying when the GM keeps the death timer hidden.
      hideDeath(parseEffects(scene[EFFECTS_KEY]), parseSettings(room[SETTINGS_KEY]).showDeath),
      parseTracker(scene[TRACKER_KEY]),
      parseSettings(room[SETTINGS_KEY]).effectIcons,
    );
    if (plan.remove.length > 0) await OBR.scene.items.deleteItems(plan.remove);
    const byId = new Map(items.map((i) => [i.id, i]));
    if (plan.add.length > 0) await OBR.scene.items.addItems(plan.add.map((w) => buildEffectIcon(byId.get(w.tokenId) as Image, w, dpi)));
  };
  const role = (r: string) => {
    gm = r === "GM";
    sync();
  };
  OBR.player
    .getRole()
    .then(role)
    .catch((err) => console.warn(`Couldn't read the role: ${errorMessage(err)}`));
  // Metadata is shared by every extension: only our keys matter.
  let lastScene: string | undefined;
  const offScene = OBR.scene.onMetadataChange((m: Metadata) => {
    const raw = JSON.stringify([m[TRACKER_KEY], m[EFFECTS_KEY]]);
    if (raw === lastScene) return;
    lastScene = raw;
    sync();
  });
  let lastOn: string | undefined;
  const offRoom = OBR.room.onMetadataChange((m: Metadata) => {
    const st = parseSettings(m[SETTINGS_KEY]);
    const on = `${st.effectIcons}:${st.showDeath}`;
    if (on === lastOn) return;
    lastOn = on;
    sync();
  });
  const offPlayer = OBR.player.onChange((p) => role(p.role));
  const offItems = OBR.scene.items.onChange(() => sync());
  const offReady = OBR.scene.onReadyChange(() => sync());
  const offGrid = OBR.scene.grid.onChange(() => sync());
  return () => {
    offScene();
    offRoom();
    offPlayer();
    offItems();
    offReady();
    offGrid();
  };
};
