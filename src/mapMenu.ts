// The map's right-click Crawl Keeper menu (docs/design.md, Torchlight
// merge): Add / Remove initiative, Add effect… and the lights, in one
// embedded submenu.
// Pure: which rows it shows for the selected tokens and what each does. A
// token outside the initiative list can still carry a light (Matt,
// 2026-10-31): the menu neither asks nor adds it.
//
// The rows are always the same nine (the embed's height is fixed when the
// menu is made); one that doesn't apply is disabled and says why.
import {
  LIGHT_KINDS,
  formatRemaining,
  litOn,
  moveLight,
  outOn,
  putOut,
  settle,
  swapLight,
  type LightKind,
  type Lights,
} from "./lights";
import type { LightAsk } from "./playerLights";
import { GM_ENTRY, type Tracker } from "./tracker";

// owner: who placed it (players may light party tokens and their own).
export type MenuToken = { id: string; name: string; layer: string; owner?: string };

export type MenuRow = {
  label: string;
  // Why it's disabled, or what it will also do.
  title?: string;
  enabled: boolean;
  icon: string;
  // Starts a new group: a thin line above it (menu.ts).
  group?: true;
  action:
    | { type: "initiative"; ids: string[] }
    // Sets (or clears, if it already is) the Party token.
    | { type: "party"; id: string }
    | { type: "lights"; step: string; fn: (s: Lights, now: number, newId: () => string) => Lights }
    // A player's: asked of the GM's client, one token at a time (playerLights.ts).
    | { type: "request"; asks: LightAsk[] }
    // Opens the panel's Add effect form for these tokens (addEffectHandoff.ts).
    | { type: "addEffect"; ids: string[] }
    | null;
};

export const MENU_ROWS = 9;
export const PLAYER_MENU_ROWS = 4;
// Group lines in each menu (rows with `group`), for the embed's fixed height:
// 36 px a row, 9 px a line (1 px plus 4 px either side), 8 px padding.
export const MENU_GROUPS = 3;
export const PLAYER_MENU_GROUPS = 1;
export const menuHeight = (rows: number, lines: number) => rows * 36 + lines * 9 + 8;
const startsGroup = (row: MenuRow): MenuRow => ({ ...row, group: true });

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

// Any token, a prop too (a cursed altar): the form says which.
const addEffectRow = (tokens: MenuToken[]): MenuRow => ({
  label: tokens.length > 1 ? `Add effect to ${tokens.length}…` : "Add effect…",
  enabled: tokens.length > 0,
  icon: "/img/menu-effect.svg",
  action: tokens.length > 0 ? { type: "addEffect", ids: tokens.map((x) => x.id) } : null,
});

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

// Two tokens selected, one holding a light (lit, else a lantern that's out):
// the light goes to the other, timer and all. Whatever moveLight refuses
// (the other already burns a light) is the row's reason.
const handRow = (s: Lights, tokens: MenuToken[], now: number): MenuRow => {
  const base = { icon: "/img/menu-hand.svg", label: "Hand light to…" };
  const no = (title: string): MenuRow => ({ ...base, enabled: false, title, action: null });
  if (tokens.length !== 2) return no("Select the token holding the light and the one to give it to");
  const [a, b] = tokens;
  const held = (x: MenuToken) => litOn(s, x.id) ?? outOn(s, x.id);
  const [la, lb] = [held(a), held(b)];
  if (!la && !lb) return no("Neither token holds a light");
  if (la && lb) return no("Both tokens hold a light");
  const [light, to] = la ? [la, b] : [lb!, a];
  const fn = (st: Lights, at: number) => moveLight(st, at, light.id, to.id, to.name);
  try {
    fn(s, now);
  } catch (err) {
    return no(err instanceof Error ? err.message : "Can't hand it on");
  }
  const kind = lower(light.kind);
  return { ...base, label: `Hand light to ${to.name}`, enabled: true, action: { type: "lights", step: `Hand ${kind} to ${to.name}`, fn } };
};

// One character token: it stands for the whole party (it is tracked if it
// isn't yet); the Party token again clears it.
const partyRow = (t: Tracker, tokens: MenuToken[]): MenuRow => {
  const base = { icon: "/img/menu-party.svg" };
  const one = tokens.length === 1 && carries(tokens[0]) ? tokens[0] : null;
  if (!one) return { ...base, label: "Set as party token", enabled: false, title: "Select one character token", action: null };
  const clearing = t.party === one.id;
  return { ...base, label: clearing ? "Clear party token" : "Set as party token", enabled: true, action: { type: "party", id: one.id } };
};

export const menuRows = (t: Tracker, s: Lights, tokens: MenuToken[], now: number): MenuRow[] => {
  const settled = settle(s, now);
  return [
    initiativeRow(t, tokens),
    addEffectRow(tokens),
    startsGroup(lightRow(settled, tokens, "torch")),
    ...CARRIED.slice(1).map((kind) => lightRow(settled, tokens, kind)),
    lightRow(settled, tokens, "campfire"),
    startsGroup(putOutRow(settled, tokens)),
    handRow(settled, tokens, now),
    startsGroup(partyRow(t, tokens)),
  ];
};

// A player's menu (Players light their own on): the three carried lights and
// Put out, on party tokens only (a player row on the list, or one they
// placed); the GM's client checks again. Same swaps as the GM's rows.
export const playerMenuRows = (t: Tracker, s: Lights, tokens: MenuToken[], now: number, playerId: string): MenuRow[] => {
  const settled = settle(s, now);
  const party = new Set(t.entries.filter((e) => e.id !== GM_ENTRY && !e.monster).map((e) => e.id));
  const ok = tokens.filter((x) => carries(x) && (party.has(x.id) || x.owner === playerId));
  const toRequest = (row: MenuRow, asks: LightAsk[]): MenuRow =>
    ok.length === 0
      ? { ...row, enabled: false, title: "Party tokens only", action: null }
      : row.enabled
        ? { ...row, action: { type: "request", asks } }
        : row;
  const rows = CARRIED.map((kind) => {
    const row = lightRow(settled, ok, kind);
    const todo = ok.filter((x) => litOn(settled, x.id)?.kind !== kind);
    return toRequest(row, todo.map((x) => ({ tokenId: x.id, action: "light", kind })));
  });
  const lit = ok.filter((x) => litOn(settled, x.id));
  return [...rows, startsGroup(toRequest(putOutRow(settled, ok), lit.map((x) => ({ tokenId: x.id, action: "putOut" }))))];
};
