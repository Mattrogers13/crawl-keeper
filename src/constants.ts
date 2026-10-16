// The extension's id. Prefixes every room/scene/item metadata key and
// broadcast channel, so it can't collide with another extension.
export const ID = "io.github.mattrogers13.crawl-keeper";

// Room metadata keys. Keep this file free of React imports so a background
// page or embedded menu can use it without pulling React in.
export const NOTE_KEY = `${ID}/note`;
