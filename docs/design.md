# Design (agreed 2026-10-15)

Shadowdark crawl companion for Owlbear Rodeo: initiative tracker, crawl round loop with encounter checks or the Crawling Clock, and (v0.2) encounter and morale rollers. Original ask: `BRIEF.md`. Rules: Shadowdark core pp. 82–88, 112; the Crawling Clock sheet (Goblin Punch "Underclock").

## Roles

- **GM** is the only writer of everything. Assumes one active GM (co-GM not supported).
- **Players** see a read-only view: order, portraits, current turn, notes, round and clock (each unless hidden). Never rolls of a hidden clock, settings, or tables.
- "Hidden" means hidden in the UI. All shared data is readable by any client. No real secrecy.

## Data

| Where | Key | Contents | Writer |
|---|---|---|---|
| Scene metadata | `${ID}/tracker` | entries `[{ id: itemId \| "gm", roll, note, dead, monster, marker }]` (players and GM row in turn order, then monsters), phase (`crawl` \| `combat`), current turn id, round, crawl `{ danger, dark, clock, crawlRounds, lastCheck, last roll, undo }` (per map: each dungeon has its own clock) | GM |
| Room metadata | `${ID}/settings` | encounter mode (`standard` \| `clock`), hide clock, show danger level, hide rounds, clear rolls on combat, select on turn | GM |
| Room metadata (v0.2) | `${ID}/tables` | custom encounter tables | GM |

- Caps: 40 entries, notes 200 chars. Worst case about 12.4 kB in the scene doc (with a full crawl roll). Settings shows the live size (tracker, whole scene, whole room). The undocumented scene limit: a full tracker (about 12 kB) saved fine in a real room, 2026-10-16.
- Entries whose token no longer exists are dropped on read.
- Changes that belong together (turn + round + crawl roll) go out in one write.

## Tracker

- Entries: tokens added via one right-click item, "Add / Remove Initiative" (background page context menu), as players and allies; the GM marks a row as a monster from its row menu (and back). Plus the built-in **GM / Monsters** row (can't be removed). Monsters roll once as a group: the GM rolls d20 + the highest monster DEX mod into the GM / Monsters row (core pp. 82, 88).
- **Monsters** are listed under the GM / Monsters row (a red edge marks the group; no indent, so their notes keep their width) and have no roll box. In combat each living monster takes a turn right after that row, in list order (the GM drags to set it). While crawling the GM turn covers them: no turns of their own. Players see the visible ones. Replaces the earlier idea of hiding the GM row (decided 2026-10-16).
- **Order:** the list is the turn order. Sort puts the highest roll first (unrolled last); ties: GM moves rows.
- Moving rows: the GM drags a row by its grip (≡; mouse, touch, or keyboard: focus the grip, Space, arrows, Space). Players can't.
- **Dead:** GM marks a token row dead from its row menu (not the GM row). Dead rows keep their seat, show a skull badge on the portrait for everyone, and get no turns; killing the current entry passes the turn on.
- ◀ / ▶ turns. Round increments when the turn wraps.
- A tracked token deleted from the map: the GM's open panel saves the tracker without it, and if it was that token's turn the turn and marker pass on (no retry loop on a failed save).
- **Row menu and batch (GM only):** click a token row to select it, Shift-click for a range, Cmd/Ctrl-click to add or remove single rows (dashed outline; Escape or a click elsewhere in the panel clears). Right-click a row, or its ⋯ button (touch), for: Mark as monster / player or ally, Mark dead / alive, Turn marker on / off, Show on map (one row only; selects the token, Owlbear's own highlight), Remove from initiative. Inside the selection the menu acts on all selected rows; a mixed selection offers both ways. Tapping the portrait also selects the token on the map.
- Remove monsters (GM, Crawl only, asks to confirm): clears every monster after a fight. Kept until then, so a fight that resumes keeps them (decided 2026-10-16).
- Reset rounds (GM, asks to confirm): the round count to 0, no one's turn; order, rolls and phase stay.
- Note under each name: GM edits, everyone sees.
- On a turn change from a GM click (▶ ◀, phase, reset, dead, remove, right-click remove; never from a data change event, or every client would add one): a gold ring (WebP, ATTACHMENT layer, locked, unclickable) moves to the current token (tokens whose own turn marker is on: players and allies start on, monsters off; changed per token in the row menu), sized 1.5x its footprint. It follows the token's position, scale and deletion (attachment defaults). Visibility is not inherited (seen in a room, 2026-10-16): the ring is created with the token's visibility, and the GM's background page re-matches it when the token is hidden or shown. A gold dot on the portrait (GM view) shows which tokens get it. No marker on the GM row or between rounds. Select the current token on the GM's screen (setting, default on).

## Crawl and Combat

- Shadowdark is always in turn order (core p. 82); the tracker is always running in one of two phases, switched by the GM's Crawl / Combat buttons. No start or end. ◀ ▶ work in both.
- **Crawl:** turns run; the crawl prompt appears on the GM / Monsters turn. Encounter checks happen on crawl rounds only (p. 112).
- **Combat:** no encounter checks or clock rolls.
- **Rounds:** one count through both phases. The book has one kind of round ("a round completes when each person has taken one turn", p. 82; spell durations and "one hour is equal to 10 rounds" run straight through fights). Only encounter checks care which kind a round was (crawl only, p. 112), so the crawl prompt (PR 4) counts crawl rounds since its last check itself. Decided 2026-10-16, replacing separate crawl and combat counts.
- Switching phase ends the current round: the next ▶ starts a new round of the new phase at the top.
- Switching to combat pops "ROLL FOR COMBAT INITIATIVE" on every client (background page; panel open or not; only on a switch seen live, not on joining mid-fight).
- Setting "Clear initiative rolls on combat" (default on, the book's new initiative, p. 88): rolls are cleared for the combat roll. Switching back to Crawl keeps the combat order and rolls (the book has no rule for returning to a crawl order; decided 2026-10-16).

## Panel

- The header and tracker controls stay in view; only the list scrolls. A grip at the bottom resizes Owlbear's popover (`OBR.action.setHeight`, 300 to 1400 px, remembered per browser).

## Settings (GM only, gear in the panel header)

- Hide rounds from players. Clear initiative rolls on combat. Show the turn marker (default on; toggling adds or removes it at once). Select the current token (default on). Saved data sizes. The install link (this build's manifest URL, with Copy). Later PRs add theirs here (encounter mode, danger level, select on turn, hide clock).

## Crawl prompt (GM panel, in the top bar while crawling)

- In the top bar, so it stays in view (status, danger level, darkness, a roll for loud noises); highlighted and asking for the roll on the GM turn when one is due. The last roll shows large (dice, then the outcome; red for an encounter). Danger level and darkness live in the bar, per map; the mode, hiding the clock and showing the danger level are in Settings. Players see the clock number in the header (unless hidden) and, if the GM allows, the danger level (the book treats it as GM-only: pp. 112, 130); never the bar.
- When: on the GM's turn of each crawl round (sheet: "rolled on the GM's turn at the end of each crawling round"; core p. 82 GM turn step 2).
- In darkness (total darkness, no light): standard checks every round (p. 84); the crawling die steps up to a d8 (sheet, "Darkness Descends").
- Crawl rounds are counted separately from the round number (combat rounds don't count, p. 112): ▶ starting a crawl round adds one, ◀ back over one takes it away, Reset rounds zeroes it.

- **Standard:** check on the danger level's cadence: Unsafe every 3 rounds, Risky every 2, Deadly every round. In darkness: every round. 1d6, encounter on 1.
- **Crawling Clock:** starts at 20 (GM reset button on entering a dangerous location). Roll the crawling die (d6; d8 when in darkness). Max roll explodes (add another roll; chain capped at 10). Subtract from the clock. At 0 or below: encounter, clock resets to 20 minus the overflow. At 1–5: omen prompt (GM may roll the encounter early).
- "Check now" / "Roll again" for loud disturbances (standard: an extra check; clock: an extra crawling-die roll). One-level undo of the last roll. "Reset clock" (asks first; also right-click the clock) resets to 20 for a new dangerous place. Rolling the encounter early at an omen starts a fresh clock.
- Rolls use `crypto.getRandomValues`.

## Releases

- **v0.1**, four PRs, each tested in a real room (GM + player) before the next:
  1. Tracker core: scene doc, GM row, sort, editing, notes, next/prev, round + hide toggle, player view, context menu. Verify the scene metadata limit.
  2. Crawl/Combat phases, combat alert, settings menu.
  3. Monsters, turn marker, select the current token, panel resize and scrolling.
  4. Crawl: Standard checks and the Crawling Clock with all options.
- **v0.2:** encounter roller (book's distance d6 / activity 2d6 / reaction 2d6+CHA, plus GM-pasted custom tables) and a standalone morale roller (d20 + WIS mod vs DC 15; holds / flees).
- **Later:** death timer (GM marks a PC dying: 1d4 + CON mod rounds, min 1; d20 prompt on each of their turns, 20 = up with 1 HP; runs out = marked dead; a dying badge with the rounds left on the portrait, visible to everyone), Time Passes (advance N crawl rounds and run the encounter checks; no effect clearing), 3D-style d20 art for the clock, half-HP morale flag, Torchlight darkness link, Owlbear Dice as a roll source, table import/export, players editing notes.
- **Not doing:** monster HP (built, then dropped 2026-10-16: players track their own on the sheet, and monster HP may suit a separate extension), Table Order (the book's clockwise-from-highest rule: a VTT has no seating, so it only added a hand-set order the screen didn't match; dropped 2026-10-16), player editing, real secrecy, shipping the book's text, light timers (Torchlight covers them), co-GM support.

## References (read-only, gitignored in `sources/`)

- `ref-initiative-tracker` (Owlbear, GPLv3) for the look; `ref-pretty-sordid-initiative` (GPLv3) for features; `ref-dice` (GPLv3) for the die style. Foundry's Shadowdark Crawl Helper (github.com/PrototypeESBU/foundryvtt-shadowdark-crawl-helper, no license file, so all rights reserved) for crawl/turn ideas. Read for behavior; don't copy code or art (this repo is MIT).
