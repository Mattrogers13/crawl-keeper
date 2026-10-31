// The map's right-click Crawl Keeper menu (docs/design.md, Torchlight
// merge): Add / Remove initiative and the lights, in one embedded submenu.
// Pure: which rows it shows for the selected tokens and what each does. A
// token outside the initiative list can still carry a light (Matt,
// 2026-10-31): the menu neither asks nor adds it.
//
// The rows are always the same six (the embed's height is fixed when the
// menu is made); one that doesn't apply is disabled and says why.
import {
  LIGHT_KINDS,
  formatRemaining,
  litOn,
  outOn,
  putOut,
  settle,
  swapLight,
  type LightKind,
  type Lights,
} from "./lights";
import type { Tracker } from "./tracker";

export type MenuToken = { id: string; name: string; layer: string };

export type MenuRow = {
  label: string;
  // Why it's disabled, or what it will also do.
  title?: string;
  enabled: boolean;
  icon: string;
  action:
    | { type: "initiative"; ids: string[] }
    | { type: "lights"; step: string; fn: (s: Lights, now: number, newId: () => string) => Lights }
    | null;
};

export const MENU_ROWS = 6;

// Torch, lantern and Light spell are carried (character tokens); a campfire
// goes on any token, a prop included.
const CARRIED: LightKind[] = ["torch", "lantern", "lightSpell"];
const carries = (t: MenuToken) => t.layer === "CHARACTER" || t.layer === "MOUNT";
const lower = (kind: LightKind) => (kind === "lightSpell" ? "Light spell" : LIGHT_KINDS[kind].label.toLowerCase());
const verb = (kind: LightKind) => (kind === "lightSpell" ? "Cast Light" : `Light ${lower(kind)}`);
const ICON: Record<LightKind, string> = {
  torch: "/img/menu-torch.svg",
  lantern: "/img/menu-lantern.svg",
  lightSpell: "/img/menu-spell.svg",
  campfire: "/img/menu-campfire.svg",
};

const initiativeRow = (t: Tracker, tokens: MenuToken[]): MenuRow => {
  const ids = tokens.filter(carries).map((x) => x.id);
  const tracked = new Set(t.entries.map((e) => e.id));
  const removing = ids.length > 0 && ids.every((id) => tracked.has(id));
  return {
    label: removing ? "Remove from initiative" : "Add to initiative",
    enabled: ids.length > 0,
    title: ids.length === 0 ? "Character tokens only" : undefined,
    icon: "/img/initiative.svg",
    action: ids.length > 0 ? { type: "initiative", ids } : null,
  };
};

// Light `kind` on each token: one already lit with another light swaps
// (put out, light this one); a lantern that's out goes back on with its
// oil; one already holding this kind lit is skipped.
const lightRow = (s: Lights, tokens: MenuToken[], kind: LightKind): MenuRow => {
  const allowed = kind === "campfire" ? tokens : tokens.filter(carries);
  const todo = allowed.filter((x) => litOn(s, x.id)?.kind !== kind);
  const base = { icon: ICON[kind], label: verb(kind) };
  if (allowed.length === 0) return { ...base, enabled: false, title: "Character tokens only", action: null };
  if (todo.length === 0) return { ...base, enabled: false, title: `${LIGHT_KINDS[kind].label} already lit`, action: null };
  // swapLight puts out what's lit and relights a waiting lantern.
  const fn = (st: Lights, at: number, newId: () => string) =>
    todo.reduce((acc, x) => swapLight(acc, at, newId, { kind, tokenId: x.id, carrier: x.name }), st);
  if (todo.length > 1) return { ...base, label: `${verb(kind)} (${todo.length})`, enabled: true, action: { type: "lights", step: verb(kind), fn } };
  const one = todo[0];
  const held = litOn(s, one.id);
  const waiting = outOn(s, one.id);
  const oil = waiting?.kind === kind ? ` (${formatRemaining(waiting.remainingMs)})` : "";
  return {
    ...base,
    label: `${verb(kind)}${oil}`,
    title: held ? `Puts out the ${lower(held.kind)}` : undefined,
    enabled: true,
    action: { type: "lights", step: held ? `Swap ${lower(held.kind)} for ${lower(kind)}` : verb(kind), fn },
  };
};

const putOutRow = (s: Lights, tokens: MenuToken[]): MenuRow => {
  const lit = tokens.map((x) => litOn(s, x.id)).filter((l) => l !== null);
  const base = { icon: "/img/menu-put-out.svg" };
  if (lit.length === 0) return { ...base, label: "Put out light", enabled: false, title: "Nothing lit", action: null };
  const fn = (st: Lights, at: number) => lit.reduce((acc, l) => putOut(acc, at, l.id), st);
  const label = lit.length === 1 ? `Put out the ${lower(lit[0].kind)}` : `Put out lights (${lit.length})`;
  return {
    ...base,
    label,
    title: lit.some((l) => l.kind === "lantern") ? "A lantern keeps its oil to the quarter hour" : undefined,
    enabled: true,
    action: { type: "lights", step: lit.length === 1 ? label : "Put out lights", fn },
  };
};

export const menuRows = (t: Tracker, s: Lights, tokens: MenuToken[], now: number): MenuRow[] => {
  const settled = settle(s, now);
  return [
    initiativeRow(t, tokens),
    ...CARRIED.map((kind) => lightRow(settled, tokens, kind)),
    lightRow(settled, tokens, "campfire"),
    putOutRow(settled, tokens),
  ];
};
