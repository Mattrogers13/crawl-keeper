// The extension's id. Prefixes every room/scene/item metadata key and
// broadcast channel, so it can't collide with another extension.
// TODO: change per extension (reverse-domain style).
export const ID = "io.github.mattrogers13.my-obr-extension";

// Room metadata keys. Keep this file free of React imports so a background
// page or embedded menu can use it without pulling React in.
export const NOTE_KEY = `${ID}/note`;
