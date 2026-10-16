# Design (agreed 2026-10-15)

Shadowdark crawl companion for Owlbear Rodeo: initiative tracker, crawl round loop with encounter checks or the Crawling Clock, and (v0.2) encounter and morale rollers. Original ask: `BRIEF.md`. Rules: Shadowdark core pp. 82–88, 112; the Crawling Clock sheet (Goblin Punch "Underclock").

## Roles

- **GM** is the only writer of everything. Assumes one active GM (co-GM not supported).
- **Players** see a read-only view: order, portraits, current turn, notes, round and clock (each unless hidden). Never monster HP, rolls of a hidden clock, settings, or tables.
- "Hidden" means hidden in the UI. All shared data is readable by any client. No real secrecy.

## Data

| Where | Key | Contents | Writer |
|---|---|---|---|
| Scene metadata | `${ID}/tracker` | entries `[{ id: itemId \| "gm", roll, note, dead, hp?: { cur, max } }]` in turn order, phase (`crawl` \| `combat`), current turn id, crawl round, combat round | GM |
| Room metadata | `${ID}/settings` | encounter mode (`standard` \| `clock`), danger level, in darkness, hide clock, hide rounds, clear rolls on combat, select on turn | GM |
| Room metadata | `${ID}/crawl` | clock value, last roll (dice, total, exploded, carry), rounds since last check | GM |
| Room metadata (v0.2) | `${ID}/tables` | custom encounter tables | GM |

- Caps: 40 entries, notes 200 chars. Worst case about 12 kB in the scene doc. The undocumented scene limit: a full tracker (about 12 kB) saved fine in a real room, 2026-10-16.
- Entries whose token no longer exists are dropped on read.
- HP lives only in the tracker; removing a monster from initiative drops its HP.
- Changes that belong together (turn + round + crawl roll) go out in one write.

## Tracker

- Entries: tokens added via right-click "Add to Initiative" (background page context menu), plus the built-in **GM / Monsters** row (can't be removed). Monsters roll once as a group: the GM rolls d20 + the highest monster DEX mod (core pp. 82, 88). Individual monster tokens may still be added (for HP, turn marker).
- **Order:** the list is the turn order. Sort puts the highest roll first (unrolled last); ties: GM moves rows.
- Moving rows: the GM drags a row by its grip (≡; mouse, touch, or keyboard: focus the grip, Space, arrows, Space). Players can't.
- **Dead:** GM toggles ☠ on a token row (not the GM row). Dead rows keep their seat, show a skull badge on the portrait for everyone, and get no turns; killing the current entry passes the turn on.
- ◀ / ▶ turns. Round increments when the turn wraps.
- Note under each name: GM edits, everyone sees.
- Monster HP: cur/max with a damage/heal field, GM-only display.
- On turn change (from the GM's click, never from a data change event): attach the turn marker (WebP, ATTACHMENT layer) to the current token; attachments inherit visibility and deletion from the parent (believed from SDK types, verify). GM row has no marker. Optional: select the token on the GM's client (setting, default on).

## Crawl and Combat

- Shadowdark is always in turn order (core p. 82); the tracker is always running in one of two phases, switched by the GM's Crawl / Combat buttons. No start or end. ◀ ▶ work in both.
- **Crawl:** turns run; the crawl prompt appears on the GM / Monsters turn. Encounter checks happen on crawl rounds only (p. 112).
- **Combat:** no encounter checks or clock rolls. Its own round count from 1; the crawl count waits.
- Switching phase ends the current round: the next ▶ starts a new round of the new phase at the top.
- Switching to combat pops "ROLL FOR COMBAT INITIATIVE" on every client (background page; panel open or not; only on a switch seen live, not on joining mid-fight).
- Setting "Clear initiative rolls on combat" (default on, the book's new initiative, p. 88): rolls are cleared for the combat roll. Switching back to Crawl keeps the combat order and rolls (the book has no rule for returning to a crawl order; decided 2026-10-16).

## Settings (GM only, gear in the panel header)

- Hide rounds from players. Clear initiative rolls on combat. The install link (this build's manifest URL, with Copy). Later PRs add theirs here (encounter mode, danger level, select on turn, hide clock).

## Crawl prompt (GM panel, Tracker tab, card under the GM / Monsters row on its turn)

- **Standard:** check on the danger level's cadence: Unsafe every 3 rounds, Risky every 2, Deadly every round. In darkness: every round. 1d6, encounter on 1.
- **Crawling Clock:** starts at 20 (GM reset button on entering a dangerous location). Roll the crawling die (d6; d8 when in darkness). Max roll explodes (add another roll; chain capped at 10). Subtract from the clock. At 0 or below: encounter, clock resets to 20 minus the overflow. At 1–5: omen prompt (GM may roll the encounter early).
- "Check now" button for loud disturbances. One-level undo of the last roll.
- Rolls use `crypto.getRandomValues`.

## Releases

- **v0.1**, four PRs, each tested in a real room (GM + player) before the next:
  1. Tracker core: scene doc, GM row, sort, editing, notes, next/prev, round + hide toggle, player view, context menu. Verify the scene metadata limit.
  2. Crawl/Combat phases, combat alert, settings menu.
  3. Map: monster HP, turn marker, selection toggle.
  4. Crawl: Standard checks and the Crawling Clock with all options.
- **v0.2:** encounter roller (book's distance d6 / activity 2d6 / reaction 2d6+CHA, plus GM-pasted custom tables) and a standalone morale roller (d20 + WIS mod vs DC 15; holds / flees).
- **Later:** a setting to hide the GM / Monsters row once monsters are added one by one (the crawl prompt lives on that row's turn, so it needs another home first), death timer (GM marks a PC dying: 1d4 + CON mod rounds, min 1; d20 prompt on each of their turns, 20 = up with 1 HP; runs out = marked dead; a dying badge with the rounds left on the portrait, visible to everyone), Time Passes (advance N crawl rounds and run the encounter checks; no effect clearing), 3D-style d20 art for the clock, half-HP morale flag, Torchlight darkness link, Owlbear Dice as a roll source, table import/export, players editing notes.
- **Not doing:** Table Order (the book's clockwise-from-highest rule: a VTT has no seating, so it only added a hand-set order the screen didn't match; dropped 2026-10-16), player editing, real secrecy, shipping the book's text, light timers (Torchlight covers them), co-GM support.

## References (read-only, gitignored in `sources/`)

- `ref-initiative-tracker` (Owlbear, GPLv3) for the look; `ref-pretty-sordid-initiative` (GPLv3) for features; `ref-dice` (GPLv3) for the die style. Foundry's Shadowdark Crawl Helper (github.com/PrototypeESBU/foundryvtt-shadowdark-crawl-helper, no license file, so all rights reserved) for crawl/turn ideas. Read for behavior; don't copy code or art (this repo is MIT).
