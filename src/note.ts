// Example shared value: a note the GM writes and everyone in the room sees.
// Replace with your extension's own data, keeping the parse-everything rule.

export const NOTE_MAX = 200;

// Room metadata is untrusted input (any client or extension can write it),
// so anything that isn't a string becomes "", and length is capped. Must also
// accept `undefined`: that's the value before the first read and in a room
// that has never had a note.
export const parseNote = (raw: unknown): string =>
  typeof raw === "string" ? raw.slice(0, NOTE_MAX) : "";
