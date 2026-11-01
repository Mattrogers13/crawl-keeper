// The extension's id. Prefixes every room/scene/item metadata key and
// broadcast channel, so it can't collide with another extension.
export const ID = "io.github.mattrogers13.crawl-keeper";

// Metadata keys. Keep this file free of React imports so the background page
// can use it without pulling React in.

// Scene metadata: the initiative tracker for this map (see tracker.ts).
export const TRACKER_KEY = `${ID}/tracker`;
// Room metadata: GM settings (see settings.ts).
export const SETTINGS_KEY = `${ID}/settings`;

export const MENU_ID = `${ID}/initiative-menu`;
// Item metadata: marks the turn marker we attach to the current token.
export const MARKER_KEY = `${ID}/marker`;
// Item metadata: marks the skull badge we attach to a dead token.
export const SKULL_KEY = `${ID}/skull`;
// On a lit token's light badge (tokenLights.ts).
export const BADGE_KEY = `${ID}/badge`;
// localStorage (this browser only): the monsters folded under the GM row.
export const MONSTERS_FOLDED_KEY = `${ID}/monsters-folded`;
// Scene metadata: a random id for this map, written by the GM the first time
// an undo step touches it, so undo can tell which map a step belongs to (the
// SDK gives scenes no id).
export const SCENE_ID_KEY = `${ID}/scene-id`;
// sessionStorage (this tab only): the GM's undo history (see undo.ts).
export const HISTORY_KEY = `${ID}/history`;
// Room metadata: the GM's light timers (see lights.ts); they cross maps with
// the party.
export const LIGHTS_KEY = `${ID}/lights`;
