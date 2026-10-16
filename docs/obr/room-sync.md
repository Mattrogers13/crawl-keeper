# Room sync: lessons from Torchlight

`src/hooks/useRoomValue.ts` handles the simple case: **one writer per key** (e.g. the GM writes, everyone reads). Stay there if you can.

If several clients must write shared data, read this first. Torchlight went through 13 code-review rounds on its sync. Its final design (below) had passed automated tests but **not yet a real-table test** when this was written (2026-10-15). Treat it as a starting point, not proven.

## The big lesson

Patching sync edge cases round after round compounded: each special case created new races. What finally worked was **simplifying the mechanism** (fewer rules) and **testing in a real Owlbear room** instead of another review round.

## Layout that avoids most races

- **One key per writer.** Torchlight: `${ID}/state` (GM only) plus `${ID}/player/<playerId>` (each player writes only their own; GMs may write any). A player's write can't clobber a GM edit because they're different keys.
- **Multi-key actions in one `setMetadata` call** (`{ keyA, keyB, keyC }`), so they land all-or-nothing.
- **Don't write someone else's key just to mark something.** Torchlight recorded burn-outs in the GM's doc, not the player's, so the GM never raced a player editing their own light.
- **Skip no-op writes.** Edit with a helper that returns the original object when nothing changed, then compare by reference.

## Torchlight's three rules (multi-writer)

Every write is stamped `{ writer, seq }` (writer = random id per page load, seq increments per write):

1. While any write of ours is in flight, ignore room change events (our write lands after anything they carry).
2. Otherwise take every event, except a late echo of our own older write (our writer id, seq below the last we sent).
3. When the last in-flight write settles (saved or failed), read the room once and take it. That reverts a failed write and picks up anything rule 1 ignored. If an event arrives while that read is out, the event is newer: drop the read.

Supporting details:

- Re-reads are one at a time; a request during one asks for one more pass. Back off on failure (to 30 s) and report once.
- A copied doc must be re-stamped before writing (`restamp`), or another client discards it as its own echo.
- Never trust a seq read from the room beyond comparing it with what you sent.
- Keep sync state module-level (not in a component) so it survives remounts, and mount only one instance.
- Known limitation: rapid continuous writes from one client can override another writer's change to the same doc (rule 1 ignores it, the next write overwrites it). Fixing it means per-field merging.

## Compatibility across deploys

Players keep old panels open across your deploy. When you change a stored format, the old build must still accept the new writes (Torchlight kept writing a legacy `rev` field for a month). Write down the removal date as a tracked task.

## Testing sync

- `src/test/obrMock.ts`: `obr.deferWrites` + `flushWrite()` apply, echo and resolve each write in order; use it to reproduce races deterministically. `writeFromElsewhere()` simulates another client.
- Then test with two real browsers (GM + player in a private window) in one room.
