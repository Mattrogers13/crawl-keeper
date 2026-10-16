// Background page: runs in every client while the extension is enabled.
// Registers the GM's right-click "Add / Remove Initiative" on tokens, and
// shows everyone the combat alert (it runs with the panel closed too).
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { MENU_ID, TRACKER_KEY } from "./constants";
import { parseTracker, toggle, type Phase } from "./tracker";
import { errorMessage, notify } from "./utils";

// Read the doc fresh at click time, so a click never writes a stale copy.
// The panel may also be writing; both are the GM's own clicks, so they don't
// overlap in practice (docs/design.md: GM is the only writer).
export const toggleInitiative = async (ids: string[]) => {
  const tracker = parseTracker((await OBR.scene.getMetadata())[TRACKER_KEY]);
  const updated = toggle(tracker, ids);
  if (updated !== tracker) await OBR.scene.setMetadata({ [TRACKER_KEY]: updated });
};

export const createMenu = () =>
  OBR.contextMenu.create({
    id: MENU_ID,
    icons: [
      {
        icon: "/img/initiative.svg",
        label: "Add / Remove Initiative",
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
      toggleInitiative(context.items.map((i) => i.id)).catch((err) =>
        notify(`Couldn't update initiative: ${errorMessage(err)}`, "ERROR"),
      );
    },
  });

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
