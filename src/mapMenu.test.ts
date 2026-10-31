import { describe, it, expect } from "vitest";
import OBR from "@owlbear-rodeo/sdk";

import { LIGHTS_KEY, TRACKER_KEY } from "./constants";
import { MINUTE, parseLights, type Lights } from "./lights";
import { menuRows, type MenuToken } from "./mapMenu";
import { render } from "./menu";
import { loadHistory } from "./undo";
import { GM_ENTRY, parseTracker } from "./tracker";
import { obr, token } from "./test/obrMock";

const NOW = 1_000_000;
const t = parseTracker({ entries: [{ id: "a" }] });
const tok = (id: string, layer = "CHARACTER", name = id.toUpperCase()): MenuToken => ({ id, name, layer });
const lit = (tokenId: string, kind = "torch") => ({ id: `l-${tokenId}`, kind, tokenId, status: "lit", remainingMs: 60 * MINUTE, endsAt: NOW + 60 * MINUTE });
const labels = (s: Lights, tokens: MenuToken[]) => menuRows(t, s, tokens, NOW).map((r) => (r.enabled ? r.label : `(${r.label})`));
const none = parseLights({});
const apply = (s: Lights, tokens: MenuToken[], i: number) => {
  const a = menuRows(t, s, tokens, NOW)[i].action;
  if (a?.type !== "lights") throw new Error("not a light row");
  let n = 0;
  return a.fn(s, NOW, () => `new-${++n}`);
};

describe("the map menu's rows", () => {
  it("one untracked token: Add to initiative and every light; nothing to put out", () => {
    expect(labels(none, [tok("b")])).toEqual(["Add to initiative", "Light torch", "Light lantern", "Cast Light", "Light campfire", "(Put out light)"]);
  });

  it("a tracked token holding a torch: Remove, the torch row off, a swap for the others, Put out the torch", () => {
    const s = parseLights({ lights: [lit("a")] });
    const rows = menuRows(t, s, [tok("a")], NOW);
    expect(labels(s, [tok("a")])).toEqual(["Remove from initiative", "(Light torch)", "Light lantern", "Cast Light", "Light campfire", "Put out the torch"]);
    expect(rows[1].title).toBe("Torch already lit");
    expect(rows[2].title).toBe("Puts out the torch");
    const swapped = apply(s, [tok("a")], 2);
    expect(swapped.lights.map((l) => [l.kind, l.status])).toEqual([["lantern", "lit"]]);
    expect(swapped.lights[0].carrier).toBe("A");
  });

  it("a lantern that's out lights again with its oil", () => {
    const s = parseLights({ lights: [{ id: "lan", kind: "lantern", tokenId: "a", status: "out", remainingMs: 30 * MINUTE, endsAt: null }] });
    expect(labels(s, [tok("a")])[2]).toBe("Light lantern (30:00)");
    const after = apply(s, [tok("a")], 2);
    expect(after.lights).toMatchObject([{ id: "lan", status: "lit", remainingMs: 30 * MINUTE }]);
  });

  it("a prop: only a campfire; initiative and the carried lights are off", () => {
    const rows = menuRows(t, none, [tok("f", "PROP")], NOW);
    expect(rows.map((r) => r.enabled)).toEqual([false, false, false, false, true, false]);
    expect(rows[0].title).toBe("Character tokens only");
  });

  it("several tokens: each one lit, skipping those already holding it; Put out lights for the lit ones", () => {
    const s = parseLights({ lights: [lit("a")] });
    const tokens = [tok("a"), tok("b"), tok("c")];
    expect(labels(s, tokens)).toEqual(["Add to initiative", "Light torch (2)", "Light lantern (3)", "Cast Light (3)", "Light campfire (3)", "Put out the torch"]);
    const after = apply(s, tokens, 1);
    expect(after.lights.filter((l) => l.status === "lit").map((l) => l.tokenId).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("the map menu page", () => {
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const setup = async () => {
    obr.role = "GM";
    obr.items = [token("a", { name: "Aria" }), token("b", { name: "Bram" })];
    obr.selection = ["a"];
    obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: GM_ENTRY }] } };
    const root = document.createElement("div");
    await render(root);
    return root;
  };
  const button = (root: HTMLElement, name: string) => [...root.querySelectorAll("button")].find((b) => b.textContent === name)!;

  it("lights a torch on the selected token as an undo step, then shows the new state", async () => {
    const root = await setup();
    button(root, "Light torch").click();
    await settle();
    expect(parseLights(obr.metadata[LIGHTS_KEY]).lights).toMatchObject([{ kind: "torch", tokenId: "a", carrier: "Aria", status: "lit" }]);
    expect(loadHistory().undo.map((s) => s.label)).toEqual(["Light torch"]);
    expect(button(root, "Light torch").disabled).toBe(true);
    expect(button(root, "Put out the torch").disabled).toBe(false);
  });

  it("adds the token to initiative through the same menu", async () => {
    const root = await setup();
    obr.selection = ["b"];
    await render(root);
    button(root, "Add to initiative").click();
    await settle();
    expect(parseTracker(obr.sceneMetadata[TRACKER_KEY]).entries.map((e) => e.id)).toContain("b");
    expect(button(root, "Remove from initiative")).toBeDefined();
  });

  it("a refused change is told, not saved", async () => {
    const root = await setup();
    obr.failWrites = true;
    button(root, "Light torch").click();
    await settle();
    expect(OBR.notification.show).toHaveBeenCalled();
    expect(loadHistory().undo).toEqual([]);
  });
});
