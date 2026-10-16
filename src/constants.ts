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
export const MONSTER_MENU_ID = `${ID}/monster-menu`;
// Item metadata: marks the turn marker we attach to the current token.
export const MARKER_KEY = `${ID}/marker`;
