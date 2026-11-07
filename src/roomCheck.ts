// Dev builds only, temporary (docs/design.md, "Combine and expand"): one click
// in a real room answers what option 2 (Party | Split manages Owlbear's
// attach) depends on, which the in-memory SDK can't. It makes three hidden
// test images at the map's origin (players never see them), checks, and
// deletes what's left. Remove before the release that ships option 2.
import OBR, { buildImage, type Item } from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { errorMessage } from "./utils";

const TAG = `${ID}/room-check`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const testImage = (name: string, x: number, layer: "CHARACTER" | "ATTACHMENT") =>
  buildImage(
    { width: 256, height: 256, mime: "image/png", url: `${window.location.origin}/img/logo.png` },
    { dpi: 256, offset: { x: 128, y: 128 } },
  )
    .name(`Crawl Keeper check: ${name}`)
    .position({ x, y: 0 })
    .layer(layer)
    .visible(false)
    .metadata({ [TAG]: true })
    .build();

export type CheckLine = { label: string; ok: boolean | null; detail: string };

export const runRoomCheck = async (): Promise<CheckLine[]> => {
  const out: CheckLine[] = [];
  const say = (label: string, ok: boolean | null, detail: string) => out.push({ label, ok, detail });
  const parent = testImage("party", 0, "CHARACTER");
  const child = testImage("player", 300, "CHARACTER");
  const ring = { ...testImage("ring", 300, "ATTACHMENT"), attachedTo: child.id };
  const get = async (id: string) => (await OBR.scene.items.getItems([id]))[0] as Item | undefined;
  try {
    await OBR.scene.items.addItems([parent, child, ring]);
    // 1. A hidden token attached by position only follows its parent.
    await OBR.scene.items.updateItems([child.id], (d) => {
      d[0].attachedTo = parent.id;
      d[0].disableAttachmentBehavior = ["ROTATION", "SCALE", "DELETE", "LOCKED", "COPY", "VISIBLE"];
    });
    await OBR.scene.items.updateItems([parent.id], (d) => {
      d[0].position = { x: 600, y: 0 };
    });
    await wait(500);
    const c1 = await get(child.id);
    const r1 = await get(ring.id);
    say("Hidden attached token follows", c1?.position.x === 900, `player at x ${c1?.position.x ?? "gone"} (expected 900)`);
    say("Its own attachment follows too", r1?.position.x === 900, `ring at x ${r1?.position.x ?? "gone"} (expected 900)`);
    say("Still hidden", c1?.visible === false, `visible: ${String(c1?.visible)}`);
    // 2. Rotating the parent with ROTATION off: does the player swing round?
    await OBR.scene.items.updateItems([parent.id], (d) => {
      d[0].rotation = 90;
    });
    await wait(500);
    const c2 = await get(child.id);
    say("Rotating the party leaves the player in place", c2?.position.x === 900 && c2?.position.y === 0 && c2?.rotation === 0, `player at (${c2?.position.x}, ${c2?.position.y}), rotation ${c2?.rotation}`);
    // 3. Deleting the parent with DELETE off: does the player survive?
    await OBR.scene.items.deleteItems([parent.id]);
    await wait(500);
    const c3 = await get(child.id);
    say("Deleting the party token keeps the player", !!c3, c3 ? `player still there (attachedTo: ${c3.attachedTo ?? "none"})` : "player was deleted with it");
  } catch (err) {
    say("Check stopped", false, errorMessage(err));
  } finally {
    const left = (await OBR.scene.items.getItems((i) => i.metadata[TAG] === true).catch(() => [])).map((i) => i.id);
    if (left.length > 0) await OBR.scene.items.deleteItems(left).catch(() => undefined);
  }
  // 4. Walls: are Dynamic Fog's walls items we can read?
  try {
    const all = await OBR.scene.items.getItems();
    const walls = all.filter((i) => i.type === "WALL") as (Item & { points?: unknown[]; blocking?: boolean })[];
    const fog = all.filter((i) => i.layer === "FOG");
    const kinds = [...new Set(fog.map((i) => i.type))].join(", ") || "none";
    say(
      "Walls readable",
      walls.length > 0 ? true : null,
      `${walls.length} WALL item${walls.length === 1 ? "" : "s"} (${walls.filter((w) => w.blocking).length} blocking, ${walls.reduce((n, w) => n + (w.points?.length ?? 0), 0)} points); FOG layer: ${fog.length} item(s), types: ${kinds}. Draw a wall with Dynamic Fog first if this is 0.`,
    );
  } catch (err) {
    say("Walls readable", false, errorMessage(err));
  }
  return out;
};
