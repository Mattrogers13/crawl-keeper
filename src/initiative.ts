// The GM's right-click Add / Remove Initiative (the map's Crawl Keeper menu).
import OBR from "@owlbear-rodeo/sdk";

import { TRACKER_KEY } from "./constants";
import { afterChange, readSettings } from "./marker";
import { record } from "./undo";
import { MAX_ENTRIES, parseTracker, toggle } from "./tracker";
import { notify } from "./utils";

// Read the doc fresh at click time, so a click never writes a stale copy.
// The panel may also be writing; both are the GM's own clicks, so they don't
// overlap in practice (docs/design.md: GM is the only writer).
export const toggleInitiative = async (ids: string[]) => {
  const [scene, settings] = await Promise.all([OBR.scene.getMetadata(), readSettings()]);
  const tracker = parseTracker(scene[TRACKER_KEY]);
  const updated = toggle(tracker, ids);
  // Adding stops at the cap: say which didn't fit rather than drop them
  // quietly, once the rest are saved (a failed save reports on its own).
  const tracked = new Set(updated.entries.map((e) => e.id));
  const removing = updated.entries.length < tracker.entries.length;
  const left = removing ? 0 : ids.filter((id) => !tracked.has(id)).length;
  const full = () => left > 0 && notify(`Initiative is full (${MAX_ENTRIES} rows): ${left} token${left === 1 ? "" : "s"} not added.`, "WARNING");
  if (updated === tracker) return full();
  await OBR.scene.setMetadata({ [TRACKER_KEY]: updated });
  // An undo step in the GM's history, shared with the panel (same tab).
  await record(removing ? "Remove from initiative" : "Add to initiative", [{ store: "scene", key: TRACKER_KEY, before: scene[TRACKER_KEY], after: updated }], { toast: removing });
  full();
  // Removing the current token passed the turn on (the marker moves with it);
  // removing a dead one takes its skull off.
  await afterChange(tracker, updated, settings);
};

