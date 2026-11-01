// The map's right-click Crawl Keeper submenu (embedded by background.ts;
// rows from mapMenu.ts). Plain DOM, no React, so it opens at once. Every GM
// action reads the room fresh at click time and is a step in the GM's undo
// history (same tab, same sessionStorage as the panel). A player's (Players
// light their own) asks the GM's client instead (playerLights.ts).
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { toggleInitiative } from "./initiative";
import { newLightId, parseLights, type Lights } from "./lights";
import { menuRows, playerMenuRows, type MenuRow, type MenuToken } from "./mapMenu";
import { requestLight } from "./playerLights";
import { parseTracker } from "./tracker";
import { record } from "./undo";
import { errorMessage, notify } from "./utils";

const changeLights = async (step: string, fn: (s: Lights, now: number, newId: () => string) => Lights) => {
  const room = await OBR.room.getMetadata();
  const before = parseLights(room[LIGHTS_KEY]);
  const after = fn(before, Date.now(), newLightId);
  if (after === before) return;
  await OBR.room.setMetadata({ [LIGHTS_KEY]: after });
  await record(step, [{ store: "room", key: LIGHTS_KEY, before, after }]);
};

const run = async (row: MenuRow) => {
  const a = row.action;
  if (a?.type === "initiative") await toggleInitiative(a.ids);
  else if (a?.type === "lights") await changeLights(a.step, a.fn);
  else if (a?.type === "request")
    for (const ask of a.asks) {
      const error = await requestLight(ask);
      if (error) return notify(error, "WARNING");
    }
};

const read = async (): Promise<MenuRow[]> => {
  const ids = (await OBR.player.getSelection()) ?? [];
  const [items, scene, room] = await Promise.all([OBR.scene.items.getItems(ids), OBR.scene.getMetadata(), OBR.room.getMetadata()]);
  const tokens: MenuToken[] = items
    .filter((i) => i.type === "IMAGE")
    .map((i) => ({ id: i.id, name: i.name, layer: i.layer, owner: i.createdUserId }));
  const [t, lights] = [parseTracker(scene[TRACKER_KEY]), parseLights(room[LIGHTS_KEY])];
  return (await OBR.player.getRole()) === "GM" ? menuRows(t, lights, tokens, Date.now()) : playerMenuRows(t, lights, tokens, Date.now(), OBR.player.id);
};

export const render = async (root: HTMLElement) => {
  const rows = await read();
  const buttons = rows.map((row) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.disabled = !row.enabled;
    if (row.title) button.title = row.title;
    const img = document.createElement("img");
    img.src = row.icon;
    img.alt = "";
    button.append(img, row.label);
    button.addEventListener("click", async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        await run(row);
      } catch (err) {
        notify(errorMessage(err), "WARNING");
      }
      // Owlbear keeps the menu open: show what's true now.
      await render(root).catch((err) => console.error(`Couldn't refresh the menu: ${errorMessage(err)}`));
    });
    return button;
  });
  root.replaceChildren(...buttons);
};

if (OBR.isAvailable) {
  OBR.onReady(async () => {
    const root = document.getElementById("menu")!;
    const theme = await OBR.theme.getTheme().catch(() => null);
    if (theme) {
      document.documentElement.style.setProperty("--text", theme.text.primary);
      document.documentElement.style.setProperty("--hover", theme.mode === "DARK" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)");
      // The icons are white; darkened on a light theme.
      if (theme.mode === "LIGHT") document.body.classList.add("light");
    }
    await render(root).catch((err) => notify(`Couldn't open the Crawl Keeper menu: ${errorMessage(err)}`, "ERROR"));
  });
}
