// Background page: runs in every client while the extension is enabled.
// Registers the GM's right-click "Add / Remove Initiative" on tokens.
import OBR from "@owlbear-rodeo/sdk";

import { MENU_ID, SETTINGS_KEY, TRACKER_KEY } from "./constants";
import { parseSettings } from "./settings";
import { parseTracker, toggle } from "./tracker";
import { errorMessage, notify } from "./utils";

// Read both docs fresh at click time, so a click never writes a stale copy.
// The panel may also be writing; both are the GM's own clicks, so they don't
// overlap in practice (docs/design.md: GM is the only writer).
export const toggleInitiative = async (ids: string[]) => {
  const [scene, room] = await Promise.all([OBR.scene.getMetadata(), OBR.room.getMetadata()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const updated = toggle(tracker, ids, parseSettings(room[SETTINGS_KEY]).orderMode);
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

OBR.onReady(() => {
  createMenu().catch((err) => console.error(`Couldn't add the initiative menu: ${errorMessage(err)}`));
});
