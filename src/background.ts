// Background page: runs in every client while the extension is enabled.
// Registers the GM's right-click Crawl Keeper menu on tokens, keeps the
// lights on the map, answers players lighting their own (on the GM's
// client), and shows everyone the combat alert and light notices (it runs
// with the panel closed too).
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { MENU_ID, PLAYER_MENU_ID, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { MENU_ROWS, PLAYER_MENU_ROWS } from "./mapMenu";
import { parseSettings } from "./settings";
import { watchLightNotices } from "./lightNotices";
import { fixMarkerVisibility } from "./marker";
import { watchLightRequests } from "./playerLights";
import { watchTokenLights } from "./tokenLights";
import { clearHistory } from "./undo";
import { parseTracker, type Phase } from "./tracker";
import { errorMessage, notify } from "./utils";

// One Crawl Keeper item on a token's right-click menu, opening a submenu
// (menu.html, rows in mapMenu.ts): Add / Remove initiative and the lights.
// Props too, for a campfire. The GM's; players get their own below.
// The embed's height is fixed here: MENU_ROWS rows of 36 px plus padding.
export const createMenu = () =>
  OBR.contextMenu.create({
    id: MENU_ID,
    icons: [
      {
        icon: "/img/initiative.svg",
        label: "Crawl Keeper",
        filter: {
          roles: ["GM"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "MOUNT", coordinator: "||" },
            { key: "layer", value: "PROP" },
            { key: "type", value: "IMAGE" },
          ],
        },
      },
    ],
    embed: { url: "/menu", height: MENU_ROWS * 36 + 8 },
  });

// The players' Crawl Keeper item: the three carried lights and Put out on
// character tokens (menu.ts shows which they may light). There only while
// the GM lets players light their own, so it's added and removed as the
// setting changes, on each player's client.
const createPlayerMenu = () =>
  OBR.contextMenu.create({
    id: PLAYER_MENU_ID,
    icons: [
      {
        icon: "/img/menu-torch.svg",
        label: "Crawl Keeper",
        filter: {
          roles: ["PLAYER"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "MOUNT" },
            { key: "type", value: "IMAGE" },
          ],
        },
      },
    ],
    embed: { url: "/menu", height: PLAYER_MENU_ROWS * 36 + 8 },
  });

export const watchPlayerMenu = () => {
  let shown: boolean | null = null;
  const see = (allowed: boolean) => {
    if (allowed === shown) return;
    shown = allowed;
    const change = allowed ? createPlayerMenu() : OBR.contextMenu.remove(PLAYER_MENU_ID);
    change.catch((err) => console.error(`Couldn't update the players' menu: ${errorMessage(err)}`));
  };
  OBR.room
    .getMetadata()
    .then((m) => see(parseSettings(m[SETTINGS_KEY]).playersLight))
    .catch((err) => console.warn(`Couldn't read the settings for the players' menu: ${errorMessage(err)}`));
  return OBR.room.onMetadataChange((m) => see(parseSettings(m[SETTINGS_KEY]).playersLight));
};

export const COMBAT_ALERT = "ROLL FOR COMBAT INITIATIVE";

// Alerts on a switch from crawl to combat seen while this client watches the
// scene, never on what's already there when a scene opens (joining or
// reloading mid-fight). The GM's own switch echoes back, so the GM sees it too.
export const watchCombat = () => {
  // This scene's phase; null until known.
  let last: Phase | null = null;
  const see = (metadata: Metadata) => {
    const phase = parseTracker(metadata[TRACKER_KEY]).phase;
    if (last === "crawl" && phase === "combat") notify(COMBAT_ALERT, "WARNING");
    last = phase;
  };
  const seed = () =>
    OBR.scene
      .getMetadata()
      .then((metadata) => {
        if (last === null) last = parseTracker(metadata[TRACKER_KEY]).phase;
      })
      .catch((err) => console.warn(`Couldn't read the scene for the combat alert: ${errorMessage(err)}`));
  OBR.scene
    .isReady()
    .then((ready) => {
      if (ready) return seed();
    })
    .catch((err) => console.warn(`Couldn't check for a scene: ${errorMessage(err)}`));
  const offReady = OBR.scene.onReadyChange((ready) => {
    last = null;
    if (ready) void seed();
  });
  const offMetadata = OBR.scene.onMetadataChange(see);
  return () => {
    offReady();
    offMetadata();
  };
};

// The GM hid or showed a token with the turn marker: the ring follows
// (Owlbear doesn't hide an attachment with its token). The GM's client only,
// so there's one writer; panel open or not.
export const watchMarkerVisibility = () => {
  let gm = false;
  const role = (r: string) => (gm = r === "GM");
  OBR.player
    .getRole()
    .then(role)
    .catch((err) => console.warn(`Couldn't read the role: ${errorMessage(err)}`));
  const offPlayer = OBR.player.onChange((p) => role(p.role));
  const offItems = OBR.scene.items.onChange((items) => {
    if (gm) void fixMarkerVisibility(items);
  });
  return () => {
    offPlayer();
    offItems();
  };
};

// The background page loads once per load of the room, so this is a reload
// (sessionStorage outlives one): undo starts empty, as designed. Reopening
// the panel doesn't come through here, so its history survives that.
clearHistory();

OBR.onReady(() => {
  createMenu().catch((err) => console.error(`Couldn't add the initiative menu: ${errorMessage(err)}`));
  watchCombat();
  watchMarkerVisibility();
  watchTokenLights();
  watchLightNotices();
  watchLightRequests();
  watchPlayerMenu();
});
