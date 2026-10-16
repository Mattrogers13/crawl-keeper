// The turn marker (a ring attached to the current token) and selecting the
// current token. Runs on the GM's client, only from the GM's own clicks
// (a turn change, a setting), never from data change events: each client
// reacting to the same change would add a marker each.
import OBR, { buildImage, type Image, type Item } from "@owlbear-rodeo/sdk";

import { MARKER_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { parseSettings, type Settings } from "./settings";
import { GM_ENTRY, parseTracker, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

type TurnSettings = Pick<Settings, "showMarker" | "selectOnTurn">;

// WebP, never SVG on the map (black square). Source: art/turn-marker.svg.
export const markerImage = () => `${window.location.origin}/img/turn-marker.webp`;
const MARKER_PX = 256;
// The ring's diameter, in token widths.
const RING = 1.5;

const report = (err: unknown) => notify(`Couldn't move the turn marker: ${errorMessage(err)}`, "WARNING");

export type MarkerState = { id: string; attachedTo: string | undefined; image: string | undefined; visible: boolean };

// Pure: which markers to delete, and which token (if any) needs a new one.
// Keeps one up-to-date marker on the token (current art, same visibility as
// the token); anything else goes (strays, duplicates, old art).
export const planMarker = (markers: MarkerState[], token: { id: string; visible: boolean } | null, image: string) => {
  let kept: string | null = null;
  const remove: string[] = [];
  for (const m of markers) {
    const good = token !== null && m.attachedTo === token.id && m.image === image && m.visible === token.visible;
    if (good && kept === null) kept = m.id;
    else remove.push(m.id);
  }
  return { remove, addTo: token !== null && kept === null ? token.id : null };
};

// Pure: rings whose visibility differs from their token's (Owlbear doesn't
// hide an attachment with its token, verified 2026-10-16).
export const markerVisibilityFixes = (items: Item[]) => {
  const visible = new Map(items.map((i) => [i.id, i.visible]));
  return items
    .filter((i) => i.metadata[MARKER_KEY] !== undefined && i.attachedTo && visible.has(i.attachedTo))
    .filter((m) => m.visible !== visible.get(m.attachedTo!))
    .map((m) => ({ id: m.id, visible: visible.get(m.attachedTo!)! }));
};

// The GM's panel calls this when the scene's items change.
export const fixMarkerVisibility = async (items: Item[]) => {
  const fixes = markerVisibilityFixes(items);
  if (fixes.length === 0) return;
  const want = new Map(fixes.map((f) => [f.id, f.visible]));
  await OBR.scene.items
    .updateItems([...want.keys()], (drafts) => {
      for (const d of drafts) d.visible = want.get(d.id)!;
    })
    .catch(report);
};

const isImage = (item: Item | undefined): item is Image => item?.type === "IMAGE";

// Sized from the token's footprint in grid cells, centred on its position.
// It follows the token (attachment): moves, scales and is deleted with it.
// It starts with the token's visibility; fixMarkerVisibility keeps it there.
export const buildMarker = (token: Image, image: string) => {
  // Item shapes come from Owlbear and other extensions: a broken size falls
  // back to one cell.
  const raw = (token.image?.width / token.grid?.dpi) * Math.max(Math.abs(token.scale?.x), Math.abs(token.scale?.y));
  const cells = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 1;
  return buildImage(
    { width: MARKER_PX, height: MARKER_PX, mime: "image/webp", url: image },
    { dpi: MARKER_PX / (cells * RING), offset: { x: MARKER_PX / 2, y: MARKER_PX / 2 } },
  )
    .name("Turn marker (Crawl Keeper)")
    .position(token.position)
    .attachedTo(token.id)
    .visible(token.visible)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["ROTATION", "COPY"])
    .metadata({ [MARKER_KEY]: true })
    .build();
};

// Pure: the token whose turn it is, if it gets the marker and selection
// (its own setting; never the GM row, none between rounds).
export const markedToken = (t: Tracker): string | null => {
  const entry = t.entries.find((e) => e.id === t.current);
  return entry && entry.id !== GM_ENTRY && entry.marker ? entry.id : null;
};

// Put the marker on `tokenId` (null: none anywhere) and, if set, select it on
// this client. Syncs run one at a time, each reading the scene fresh: two
// overlapping syncs (quick clicks) working from the same old item list would
// both delete the same ring, and the second delete fails.
let queue: Promise<unknown> = Promise.resolve();
export const syncTurn = (tokenId: string | null, settings: TurnSettings): Promise<void> => {
  const run = queue.then(() => syncNow(tokenId, settings));
  queue = run.catch(() => {});
  return run;
};

const syncNow = async (tokenId: string | null, settings: TurnSettings) => {
  const all = await OBR.scene.items.getItems();
  const token = all.find((i) => i.id === tokenId);
  const target = settings.showMarker && isImage(token) ? token : null;
  const image = markerImage();
  const plan = planMarker(
    all
      .filter((i) => i.metadata[MARKER_KEY] !== undefined)
      .map((m) => ({ id: m.id, attachedTo: m.attachedTo, image: isImage(m) ? m.image.url : undefined, visible: m.visible })),
    target,
    image,
  );
  // Independent: old markers out, the new one in, the selection. A partial
  // failure is tidied by the next sync (planMarker drops strays).
  await Promise.all([
    plan.remove.length > 0 && OBR.scene.items.deleteItems(plan.remove),
    plan.addTo && target && OBR.scene.items.addItems([buildMarker(target, image)]),
    settings.selectOnTurn && token && OBR.player.select([token.id], true),
  ]);
};

// Every write that may change whose turn it is calls this (panel and
// right-click). The tracker change is saved either way; a marker failure
// only warns.
// A token's own marker setting changing on the current turn counts too.
export const afterTurnChange = async (before: Tracker, after: Tracker, settings: TurnSettings) => {
  const token = markedToken(after);
  if (after.current === before.current && token === markedToken(before)) return;
  // Same turn, only the token's marker setting changed: don't reselect.
  const select = settings.selectOnTurn && after.current !== before.current;
  await syncTurn(token, { showMarker: settings.showMarker, selectOnTurn: select }).catch(report);
};

// After the marker setting changes: add or remove it for whoever's turn it
// is now (no selection change). No scene open: nothing to do.
export const syncTurnFromScene = (settings: Pick<Settings, "showMarker">) =>
  OBR.scene
    .isReady()
    .then(async (ready) => {
      if (!ready) return;
      const scene = await OBR.scene.getMetadata();
      const tokenId = markedToken(parseTracker(scene[TRACKER_KEY]));
      await syncTurn(tokenId, { showMarker: settings.showMarker, selectOnTurn: false });
    })
    .catch(report);

// For the background page: the current settings from the room.
export const readSettings = async () => parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]);
