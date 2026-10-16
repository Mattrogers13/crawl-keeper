// The turn marker (a ring attached to the current token) and selecting the
// current token. Runs on the GM's client, only from the GM's own clicks
// (a turn change, a setting), never from data change events: each client
// reacting to the same change would add a marker each.
import OBR, { buildImage, type Image, type Item } from "@owlbear-rodeo/sdk";

import { MARKER_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { parseSettings, type Settings } from "./settings";
import { GM_ENTRY, parseTracker } from "./tracker";

// WebP, never SVG on the map (black square). Source: art/turn-marker.svg.
export const markerImage = (origin: string) => `${origin}/img/turn-marker.webp`;
const MARKER_PX = 256;
// The ring's diameter, in token widths.
const RING = 1.3;

export type MarkerState = { id: string; attachedTo: string | undefined; image: string | undefined };

// Pure: which markers to delete, and which token (if any) needs a new one.
// Keeps one up-to-date marker on the token; anything else goes (strays,
// duplicates, old art).
export const planMarker = (markers: MarkerState[], tokenId: string | null, image: string) => {
  let kept: string | null = null;
  const remove: string[] = [];
  for (const m of markers) {
    if (tokenId !== null && kept === null && m.attachedTo === tokenId && m.image === image) kept = m.id;
    else remove.push(m.id);
  }
  return { remove, addTo: tokenId !== null && kept === null ? tokenId : null };
};

// Sized from the token's footprint in grid cells, centred on its position.
// It follows the token (attachment): moves, scales, hides and is deleted with it.
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
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["ROTATION", "COPY"])
    .metadata({ [MARKER_KEY]: true })
    .build();
};

const isImage = (item: Item | undefined): item is Image => item?.type === "IMAGE";

// Put the marker on `current` (none for the GM row or between rounds) and,
// if set, select that token on this client.
export const syncTurn = async (current: string | null, settings: Pick<Settings, "showMarker" | "selectOnTurn">) => {
  const tokenId = current !== null && current !== GM_ENTRY ? current : null;
  const items = await OBR.scene.items.getItems((item) => item.metadata[MARKER_KEY] !== undefined || item.id === tokenId);
  const token = items.find((i) => i.id === tokenId);
  const markers = items.filter((i) => i.metadata[MARKER_KEY] !== undefined);
  const image = markerImage(window.location.origin);
  const plan = planMarker(
    markers.map((m) => ({ id: m.id, attachedTo: m.attachedTo, image: isImage(m) ? m.image.url : undefined })),
    settings.showMarker && isImage(token) ? token.id : null,
    image,
  );
  if (plan.remove.length > 0) await OBR.scene.items.deleteItems(plan.remove);
  if (plan.addTo && isImage(token)) await OBR.scene.items.addItems([buildMarker(token, image)]);
  if (settings.selectOnTurn && token) await OBR.player.select([token.id], true);
};

// After a settings change: the marker for whoever's turn it is now.
export const syncTurnFromScene = async (settings: Pick<Settings, "showMarker">) => {
  const scene = await OBR.scene.getMetadata();
  await syncTurn(parseTracker(scene[TRACKER_KEY]).current, { showMarker: settings.showMarker, selectOnTurn: false });
};

// For the background page: the current settings from the room.
export const readSettings = async () => parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]);
