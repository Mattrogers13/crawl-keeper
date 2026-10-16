// The turn marker (a ring attached to the current token) and selecting the
// current token. Runs on the GM's client, only from the GM's own clicks
// (a turn change, a setting), never from data change events: each client
// reacting to the same change would add a marker each.
import OBR, { buildImage, type Image, type Item } from "@owlbear-rodeo/sdk";

import { MARKER_KEY, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { parseSettings, type Settings } from "./settings";
import { GM_ENTRY, parseTracker, type Tracker } from "./tracker";
import { errorMessage, notify } from "./utils";

type TurnSettings = Pick<Settings, "showMarker" | "selectOnTurn" | "markMonsters">;

// WebP, never SVG on the map (black square). Source: art/turn-marker.svg.
export const markerImage = () => `${window.location.origin}/img/turn-marker.webp`;
const MARKER_PX = 256;
// The ring's diameter, in token widths.
const RING = 1.5;

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

const isImage = (item: Item | undefined): item is Image => item?.type === "IMAGE";

// A ring image sized from the token's footprint in grid cells, centred on
// its position.
const ring = (token: Image, image: string) => {
  // Item shapes come from Owlbear and other extensions: a broken size falls
  // back to one cell.
  const raw = (token.image?.width / token.grid?.dpi) * Math.max(Math.abs(token.scale?.x), Math.abs(token.scale?.y));
  const cells = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 1;
  return buildImage(
    { width: MARKER_PX, height: MARKER_PX, mime: "image/webp", url: image },
    { dpi: MARKER_PX / (cells * RING), offset: { x: MARKER_PX / 2, y: MARKER_PX / 2 } },
  )
    .position(token.position)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true);
};

// It follows the token (attachment): moves, scales, hides and is deleted with it.
export const buildMarker = (token: Image, image: string) =>
  ring(token, image)
    .name("Turn marker (Crawl Keeper)")
    .attachedTo(token.id)
    .disableAttachmentBehavior(["ROTATION", "COPY"])
    .metadata({ [MARKER_KEY]: true })
    .build();

// "Show on map" (the GM right-clicks a row): a cyan ring only this client
// sees (a local item), flashed for a moment, and the token selected.
export const LOCATE_MS = 2500;
export const locateImage = () => `${window.location.origin}/img/locate-marker.webp`;

export const locate = async (token: Item) => {
  if (!isImage(token)) return;
  const flash = ring(token, locateImage()).name("Show on map (Crawl Keeper)").build();
  await Promise.all([OBR.scene.local.addItems([flash]), OBR.player.select([token.id], true)]);
  setTimeout(() => {
    OBR.scene.local.deleteItems([flash.id]).catch((err) => console.warn(`Couldn't clear the highlight: ${errorMessage(err)}`));
  }, LOCATE_MS);
};

// Pure: the token whose turn it is, if it gets the marker and selection.
// None for the GM row or between rounds; monsters only with markMonsters.
export const markedToken = (t: Tracker, markMonsters: boolean): string | null => {
  const entry = t.entries.find((e) => e.id === t.current);
  if (!entry || entry.id === GM_ENTRY || (entry.monster && !markMonsters)) return null;
  return entry.id;
};

// Put the marker on `tokenId` (null: none anywhere) and, if set, select it on
// this client. `items` is the scene's items when the caller already has them
// (the panel keeps them live); otherwise they're read, which copies the whole
// scene over postMessage.
export const syncTurn = async (tokenId: string | null, settings: Omit<TurnSettings, "markMonsters">, items?: Item[]) => {
  const all = items ?? (await OBR.scene.items.getItems());
  const token = all.find((i) => i.id === tokenId);
  const target = settings.showMarker && isImage(token) ? token : null;
  const image = markerImage();
  const plan = planMarker(
    all
      .filter((i) => i.metadata[MARKER_KEY] !== undefined)
      .map((m) => ({ id: m.id, attachedTo: m.attachedTo, image: isImage(m) ? m.image.url : undefined })),
    target?.id ?? null,
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

const report = (err: unknown) => notify(`Couldn't move the turn marker: ${errorMessage(err)}`, "WARNING");

// Every write that may change whose turn it is calls this (panel and
// right-click). The tracker change is saved either way; a marker failure
// only warns.
export const afterTurnChange = async (before: Tracker, after: Tracker, settings: TurnSettings, items?: Item[]) => {
  if (after.current === before.current) return;
  await syncTurn(markedToken(after, settings.markMonsters), settings, items).catch(report);
};

// After a marker setting changes: add, move or remove it for whoever's turn
// it is now (no selection change). No scene open: nothing to do.
export const syncTurnFromScene = (settings: Pick<Settings, "showMarker" | "markMonsters">) =>
  OBR.scene
    .isReady()
    .then(async (ready) => {
      if (!ready) return;
      const scene = await OBR.scene.getMetadata();
      const tokenId = markedToken(parseTracker(scene[TRACKER_KEY]), settings.markMonsters);
      await syncTurn(tokenId, { showMarker: settings.showMarker, selectOnTurn: false });
    })
    .catch(report);

// For the background page: the current settings from the room.
export const readSettings = async () => parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]);
