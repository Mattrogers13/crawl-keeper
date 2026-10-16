// Background page: runs in every client while the extension is enabled.
// Registers the GM's right-click "Add / Remove Initiative" and "Add / Remove
// Monster" on tokens, and
// shows everyone the combat alert (it runs with the panel closed too).
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { MENU_ID, MONSTER_MENU_ID, TRACKER_KEY } from "./constants";
import { afterTurnChange, readSettings } from "./marker";
import { parseTracker, toggle, type Phase } from "./tracker";
import { errorMessage, notify } from "./utils";

// Read the doc fresh at click time, so a click never writes a stale copy.
// The panel may also be writing; both are the GM's own clicks, so they don't
// overlap in practice (docs/design.md: GM is the only writer).
export const toggleInitiative = async (ids: string[], monster = false) => {
  const [scene, settings] = await Promise.all([OBR.scene.getMetadata(), readSettings()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const updated = toggle(tracker, ids, monster);
  if (updated === tracker) return;
  await OBR.scene.setMetadata({ [TRACKER_KEY]: updated });
  // Removing the current token passed the turn on: move the marker with it.
  await afterTurnChange(tracker, updated, settings);
};

const menuItem = (id: string, icon: string, label: string, monster: boolean) =>
  OBR.contextMenu.create({
    id,
    icons: [
      {
        icon,
        label,
        filter: {
          roles: ["GM"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "MOUNT" },
            { key: "type", value: "IMAGE" },
          ],
        },
      },
    ],
    onClick: (context) => {
      toggleInitiative(
        context.items.map((i) => i.id),
        monster,
      ).catch((err) => notify(`Couldn't update initiative: ${errorMessage(err)}`, "ERROR"));
    },
  });

// Players' tokens get their own rolls; monsters act in the GM / Monsters turn.
export const createMenu = () =>
  Promise.all([
    menuItem(MENU_ID, "/img/initiative.svg", "Add / Remove Initiative", false),
    menuItem(MONSTER_MENU_ID, "/img/monster.svg", "Add / Remove Monster", true),
  ]);

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

OBR.onReady(() => {
  createMenu().catch((err) => console.error(`Couldn't add the initiative menu: ${errorMessage(err)}`));
  watchCombat();
});
