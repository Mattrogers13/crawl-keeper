// Dev builds only, temporary (docs/design.md, "Combine and expand"): one click
// in a real room answers what option 2 (Party | Split manages Owlbear's
// attach) depends on, which the in-memory SDK can't. It makes three hidden
// test images at the map's origin (players never see them), checks, and
// deletes what's left. Remove before the release that ships option 2.
import OBR, { buildImage, type Item } from "@owlbear-rodeo/sdk";

import { ID, LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { parseLights } from "./lights";
import { GM_ENTRY, parseTracker } from "./tracker";
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
  // 0. This map's party, as Crawl Keeper and the map see it (for a stuck switch).
  try {
    const [scene, room, items] = await Promise.all([OBR.scene.getMetadata(), OBR.room.getMetadata(), OBR.scene.items.getItems()]);
    const t = parseTracker(scene[TRACKER_KEY]);
    const lights = parseLights(room[LIGHTS_KEY]);
    const byId = new Map(items.map((i) => [i.id, i]));
    const desc = (id: string) => {
      const i = byId.get(id);
      if (!i) return `${id.slice(0, 8)}: not on the map`;
      const l = lights.lights.filter((x) => x.tokenId === id).map((x) => `${x.kind} ${x.status}`).join("/");
      return `${i.name}: ${i.visible ? "shown" : "hidden"}, attached to ${i.attachedTo ? (byId.get(i.attachedTo)?.name ?? i.attachedTo.slice(0, 8)) : "nothing"}${l ? `, ${l}` : ""}`;
    };
    say("Party (tracker)", null, t.party === null ? "no party token" : `party ${desc(t.party)}; ${t.together ? "together" : "split"}; ${t.phase}; carrier ${t.carrier ? (byId.get(t.carrier)?.name ?? "gone") : "none"}`);
    for (const e of t.entries.filter((e) => e.id !== GM_ENTRY && !e.monster && e.id !== t.party)) say("Player", null, `${desc(e.id)}${e.dead ? " (dead)" : ""}`);
    // The lights as Dynamic Fog sees them: the light data on each party token
    // (ours or the token's own), and the lights Dynamic Fog built in this browser.
    const DF = "rodeo.owlbear.dynamic-fog/light";
    for (const id of [...(t.party ? [t.party] : []), ...t.entries.filter((e) => e.id !== GM_ENTRY && !e.monster && e.id !== t.party).map((e) => e.id)]) {
      const i = byId.get(id);
      if (!i) continue;
      const ours = Object.fromEntries(Object.entries(i.metadata).filter(([k]) => k.startsWith(ID)));
      if (i.metadata[DF] !== undefined || Object.keys(ours).length > 0)
        say("Light data", null, `${i.name}: Dynamic Fog ${JSON.stringify(i.metadata[DF] ?? null)}; Crawl Keeper ${JSON.stringify(ours)}; layer ${i.layer}, ${i.visible ? "shown" : "hidden"}, scale ${i.scale.x}`);
    }
    const localLights = await OBR.scene.local.getItems((i) => i.type === "LIGHT").catch(() => []);
    for (const l of localLights) {
      const { attenuationRadius, sourceRadius, falloff, lightType } = l as Item & Record<string, unknown>;
      say("Local light", null, `on ${l.attachedTo ? (byId.get(l.attachedTo)?.name ?? l.attachedTo.slice(0, 8)) : "nothing"} at (${Math.round(l.position.x)}, ${Math.round(l.position.y)}), radius ${String(attenuationRadius)}, source ${String(sourceRadius)}, falloff ${String(falloff)}, ${String(lightType)}, ${l.visible ? "shown" : "hidden"}`);
    }
  } catch (err) {
    say("Party (tracker)", false, errorMessage(err));
  }
  // 4. Walls: are Dynamic Fog's walls items we can read?
  try {
    const all = await OBR.scene.items.getItems();
    const walls = all.filter((i) => i.type === "WALL") as (Item & { points?: unknown[]; blocking?: boolean })[];
    const fog = all.filter((i) => i.layer === "FOG");
    const kinds = [...new Set(fog.map((i) => i.type))].join(", ") || "none";
    // A census, to find where Dynamic Fog keeps its walls if not as WALL items:
    // every layer / type pair, and any item carrying Dynamic Fog's metadata.
    const census = new Map<string, number>();
    for (const i of all) census.set(`${i.layer}/${i.type}`, (census.get(`${i.layer}/${i.type}`) ?? 0) + 1);
    say("Items on this map", null, [...census].map(([k, n]) => `${k} ×${n}`).join(", ") || "none");
    const fogKeys = new Map<string, number>();
    for (const i of all)
      for (const k of Object.keys(i.metadata)) if (/fog|wall|door/i.test(k)) fogKeys.set(`${i.layer}/${i.type} ${k}`, (fogKeys.get(`${i.layer}/${i.type} ${k}`) ?? 0) + 1);
    say("Fog or wall data on items", fogKeys.size > 0 ? true : null, [...fogKeys].map(([k, n]) => `${k} ×${n}`).join("; ") || "none");
    // Dynamic Fog builds its walls from the fog tool's shapes: FOG-layer PATHs.
    // How are they drawn (straight lines or curves, relative to the item's
    // position?), and what do their own metadata keys say (doors?).
    const shapes = all.filter((i) => i.layer === "FOG" && i.type === "PATH") as (Item & { commands?: unknown[][] })[];
    for (const [n, sh] of shapes.slice(0, 3).entries()) {
      const kinds = new Map<number, number>();
      for (const c of sh.commands ?? []) kinds.set(c[0] as number, (kinds.get(c[0] as number) ?? 0) + 1);
      const named = [...kinds].map(([k, v]) => `${["move", "line", "quad", "conic", "cubic", "close"][k] ?? k} ×${v}`).join(", ");
      const first = (sh.commands ?? [])[0];
      const b = await OBR.scene.items.getItemBounds([sh.id]).catch(() => null);
      say(
        `Fog shape ${n + 1}`,
        null,
        `${named}; first point (${first?.[1]}, ${first?.[2]}); item position (${Math.round(sh.position.x)}, ${Math.round(sh.position.y)}), rotation ${sh.rotation}, scale ${sh.scale.x}; bounds ${b ? `(${Math.round(b.min.x)}, ${Math.round(b.min.y)})–(${Math.round(b.max.x)}, ${Math.round(b.max.y)})` : "?"}; metadata: ${Object.keys(sh.metadata).join(", ") || "none"}`,
      );
    }
    const local = await OBR.scene.local.getItems().catch(() => []);
    const localCensus = new Map<string, number>();
    for (const i of local) localCensus.set(`${i.layer}/${i.type}`, (localCensus.get(`${i.layer}/${i.type}`) ?? 0) + 1);
    say("Local items (this browser only)", null, [...localCensus].map(([k, n]) => `${k} ×${n}`).join(", ") || "none");
    const sceneKeys = Object.keys(await OBR.scene.getMetadata()).filter((k) => /fog|wall|door/i.test(k));
    say("Fog or wall data on the scene", sceneKeys.length > 0 ? true : null, sceneKeys.join(", ") || "none");
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
