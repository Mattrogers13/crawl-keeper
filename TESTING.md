# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`).

## PR 1: tracker core (v0.1, 2026-10-15)

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM: right-click a character token | "Add / Remove Initiative" appears; player's right-click doesn't show it | Pass 2026-10-16 |
| 2 | GM: add 3 tokens (one multi-select click works too); right-click one again | Added in that order under the GM / Monsters row; second click removes it | Pass 2026-10-16 |
| 3 | GM: type rolls, Enter / click away; add notes | Saved; player sees rolls and notes live (no inputs, no buttons) | Pass 2026-10-16 |
| 4 | GM: Sort | Highest roll first, unrolled last | Pass 2026-10-16 |
| 5 | GM: Start, Next through a full round, Previous | Current row highlighted for both; round ticks on wrap | Pass 2026-10-16 |
| 6 | GM: Hide round | Player sees "In progress" instead of the round | Pass 2026-10-16 |
| 7 | GM: hide a monster token (Owlbear visibility), make it its turn | Player doesn't see the monster; GM / Monsters row shows as current for the player | Pass 2026-10-16 |
| 8 | GM: delete a tracked token from the map | It drops from the list; if it was current, turn passes to the next | Pass 2026-10-16 |
| 9 | Switch to another scene and back | Each map keeps its own tracker | Pass 2026-10-16 |
| 10 | Close the scene | Panel says "Open a scene to use the tracker." | Pass 2026-10-16 |
| 11 | **Biggest tracker fits (unverified).** All tracker data lives in one blob on the scene; Owlbear's cap on that blob isn't documented. A full tracker (40 rows, every note maxed) is about 12 kB. Fill it once to prove it saves: put one token on the map, select it, Cmd+C / Cmd+V; select all and paste again (doubles each time) until 40; drag-select all → right-click → Add. Paste the line below into every note, mark a few dead, press Start | No "Couldn't save" error; a reload shows everything still there. If it fails, record the error text here | Pass 2026-10-16 |
| 12 | Theme: switch Owlbear light/dark | Panel follows | Pass 2026-10-16 |
| 13 | Context menu icon | Renders white (SVG is fine for menu icons; Torchlight uses one) | Pass 2026-10-16 |
| 14 | GM: look down the roll boxes, GM row included | All in one straight column | Pass 2026-10-16 |
| 15 | GM: ↕ Reorder on, move a row, Reorder off | ▲▼ appear only while on; the move saves | Pass 2026-10-16 |
| 16 | GM: ☠ on a token on its turn; Next through a round; ☠ again | Turn passes on; dead row greyed with a skull and skipped (player sees it greyed too); un-marking gives turns back | Pass 2026-10-16 |

Note for step 11 (200 characters):

```
Note-test-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-K
```

## PR 2: Crawl and Combat, settings (v0.1, 2026-10-16)

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM: open the panel on a fresh map | Crawl selected, "Press ▶ to begin", ◀ greyed out; player sees "Crawl" | Pass 2026-10-16 |
| 2 | GM: ▶ through two rounds, ◀ once | Round count goes up on wrap and back on ◀; player follows | Pass 2026-10-16 |
| 3 | GM: Combat (player's panel closed) | "ROLL FOR COMBAT INITIATIVE" pops up for both GM and player; rolls cleared; "Press ▶ to begin" | Pass 2026-10-16 |
| 4 | GM: enter rolls, sort, ▶ | Round 1 (combat); player sees "Combat" and Round 1 | Pass 2026-10-16 |
| 5 | GM: Crawl | Combat order and rolls stay; crawl round count as before combat; no alert | Pass 2026-10-16 |
| 6 | Player: reload during combat | No alert on reload | Pass 2026-10-16 |
| 7 | GM: gear → turn off "Clear initiative rolls on combat"; back; Combat | Rolls kept; alert still shows | Pass 2026-10-16 |
| 8 | GM: gear → "Hide rounds from players" | Player sees Crawl / Combat but no round count | Pass 2026-10-16 |
| 9 | Player | No gear, no buttons | Pass 2026-10-16 |
| 10 | Size: the 40-token map from PR 1, Combat with clear rolls on | Saves without "Couldn't save" | Pass 2026-10-16 |
| 11 | GM: drag a row by its ≡ grip (mouse; and on the iPad, touch) | Row moves and stays; player follows. Player has no grip | Pass 2026-10-16 |
| 12 | GM: focus a grip, Space, ↓, Space | Row moves down one | Pass 2026-10-16 |
| 13 | GM: gear → Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); pasted URL is the Dev manifest | Pass 2026-10-16 |
| 14 | After removing and re-adding the Dev extension | One toolbar icon; one combat alert per client | Pass 2026-10-16 |
| 15 | GM: Reset rounds → Cancel; then Reset rounds → Reset | Cancel changes nothing; Reset puts both counts to 0 and "Press ▶ to begin", rolls and order kept | Pass 2026-10-16 |

## PR 3: monsters, turn marker, select the current token, panel (v0.1, 2026-10-16)

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM: right-click two tokens on the map → "Add / Remove Initiative" (the only item); in the tracker right-click each row → Mark as monster | They move under GM / Monsters with a red edge, not indented, no roll box; notes full width; player sees them (unless hidden) | Pass 2026-10-16 |
| 2 | GM: row menu on one of them → Mark as player or ally; then the ⋯ button on a row (and on the iPad) | It goes back to a player row with a roll box; ⋯ opens the same menu (Mark dead / alive, Show on map, Remove too); Escape or a click elsewhere closes it | Pass 2026-10-16 |
| 3 | GM: drag monsters within the group; drag the GM row among players | Monsters reorder in the group only and travel with the GM row; Sort leaves the monsters' order alone | Pass 2026-10-16 |
| 4 | GM: Crawl, ▶ through a round | GM / Monsters, then the next player: monsters get no turns of their own | Pass 2026-10-16 |
| 5 | GM: Combat, ▶ through a round | GM / Monsters, then each living monster in order, then the next player; dead monsters skipped | Pass 2026-10-16 |
| 6 | GM: ▶ onto a player's token | Gold ring (a bit bigger than the token) around it; the token is selected on the GM's screen | Pass 2026-10-16 |
| 7 | GM: ▶ onto a monster (combat) | No ring, no selection | Pass 2026-10-16 |
| 8 | GM: row menu on a monster → Turn marker on; ▶ onto it (and try it on its own turn) | Ring and selection on that monster only; turning it on during its turn adds the ring at once | Pass 2026-10-16 |
| 9 | GM: a hidden token's turn (marker on); then show it, hide it again | GM sees the ring faded like the token; player never sees the ring while the token is hidden, and sees it once shown; the GM row shows as current for the player while hidden | Pass 2026-10-16 |
| 10 | GM: ▶ onto GM / Monsters | Ring disappears; selection unchanged | Pass 2026-10-16 |
| 11 | GM: move, resize and rotate the current token | Ring follows position and size, stays upright | Pass 2026-10-16 |
| 12 | GM: delete the current token from the map (panel open); then make another token current and remove it with the map right-click, then with the row menu | Each time: the turn and the ring pass to the next token | Pass 2026-10-16 |
| 13 | Player | Ring visible on visible tokens; can't select or move it | Pass 2026-10-16 |
| 14 | GM: gear → turn marker off, then on | Ring disappears at once, comes back on the current token | Pass 2026-10-16 |
| 15 | GM: gear → Select the current token off; ▶ | Turn moves, selection doesn't | Pass 2026-10-16 |
| 16 | Add enough tokens to overflow the panel; scroll the list | Crawl Keeper title, Crawl/Combat, arrows and sort stay in view | Pass 2026-10-16 |
| 17 | Drag the grip at the bottom down, close and reopen the panel | Panel grows and keeps its height (player: same, their own) | Pass 2026-10-16 |
| 18 | GM: gear → Saved data | Shows tracker, whole map and room sizes | Pass 2026-10-16 |
| 19 | GM: in Combat, look for "Remove monsters"; switch to Crawl; Remove monsters → Cancel; then → Remove | Not offered in Combat; Cancel keeps them; Remove clears every monster, players and GM row stay | Pass 2026-10-16 |
| 20 | GM: row menu → Show on map; then tap a portrait | The token is selected on the GM's screen (no extra ring); players see nothing | Pass 2026-10-16 |
| 21 | GM: ▶ through a crawl round into Combat and on, then back to Crawl | The round count keeps going (no restart in combat) | Pass 2026-10-16 |
| 22 | GM: ring on a player's turn; gear → turn marker off | Ring disappears at once. If not: any "Couldn't move the turn marker" warning? Record it here | Pass 2026-10-16 |
| 23 | GM: click a row, Shift-click another, Cmd-click a third elsewhere; right-click inside the selection | Dashed outlines on the chosen rows; menu titled "N selected" without Show on map; Mark as monster / dead / marker and Remove apply to all; Escape clears | Pass 2026-10-16 |
| 24 | GM: gold dots | A small gold dot on the portraits of tokens that get the turn marker; it moves when you turn the marker on/off in the row menu; players see no dots | Pass 2026-10-16 |
| 25 | GM: gear | Each setting has a one-line plain description | Pass 2026-10-16 |
| 26 | GM: select rows, then click anywhere in the panel outside the token rows | The dashed outlines clear | |

## PR 4: encounter checks and the Crawling Clock (v0.1, 2026-10-16)

Reload the room after a Dev rebuild (the background page loads once per room).

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM, Crawl: look at the header | Right under "Crawl Keeper", above Crawl/Combat: a "Checks" strip with Unsafe / Risky / Deadly and "In darkness (every round)"; "Next in 3 crawl rounds"; it stays put when the list scrolls. Players see no strip | Pass 2026-10-16 |
| 2 | GM: ▶ through 3 crawl rounds (Unsafe) | On the GM turn of round 3 the card lights up: "A check is due"; "Roll check (d6)" | Pass 2026-10-16 |
| 3 | GM: Roll check; then Undo | Big result: the die, then "No encounter" or a red "ENCOUNTER!" block; Undo puts it back | Pass 2026-10-16 |
| 4 | GM: Risky, then Deadly, then In darkness | Checks every 2 crawl rounds, every round, every round | Pass 2026-10-16 |
| 5 | GM: Combat for a few rounds, then Crawl | Card hidden in combat; combat rounds don't count toward the next check | Pass 2026-10-16 |
| 6 | GM: no check due | No roll button (the loud-noise roll was removed) | |
| 7 | GM: gear → Crawling Clock | Strip shows "Clock 20 / 20"; players see "Clock 20" in their header | Pass 2026-10-16 |
| 8 | GM: ▶ to the GM turn; Roll d6 | Big result: dice, "= total", "Clock 20 → 12"; a 6 rolls again and adds; no roll button after | Pass 2026-10-16 |
| 9 | GM: In darkness; roll | The die is a d8 | Pass 2026-10-16 |
| 10 | GM: get the clock to 5 or lower | Amber omen reminder (roll your encounter table now and telegraph it); no button | Pass 2026-10-16 |
| 11 | GM: roll past 0 (e.g. clock 3, roll 5) | "the clock hits 0. Encounter! Next clock: 18." | Pass 2026-10-16 |
| 12 | GM: Reset clock → Cancel; Reset clock → Reset; right-click the clock number → Reset | Cancel keeps it; Reset puts it back to 20 | Pass 2026-10-16 |
| 13 | GM: gear → Hide the clock from players | Player's "Clock" disappears | Pass 2026-10-16 |
| 14 | Switch to another map and back | Each map keeps its own clock, danger level and darkness | Pass 2026-10-16 |
| 15 | Reset rounds | The crawl round count starts over too (next check in 3 again when Unsafe) | Pass 2026-10-16 |
| 16 | GM: gear (Standard) → Show the danger level to players | Player sees "Unsafe" / "Risky" / "Deadly" in their header while crawling | Pass 2026-10-16 |
| 17 | GM: gear → Roll automatically on the GM turn; ▶ onto GM / Monsters (clock: any crawl round; standard: when due) | The roll happens by itself and the big result shows; Undo works; no roll in Combat or on other turns | Pass 2026-10-16 |
| 19 | GM (clock): Combat with the clock at, say, 9; then Crawl | Clock back to 20; no marker warning. If a warning appears, record its text | Pass 2026-10-16 |
| 20 | GM: ▶ quickly several times, switch Combat / Crawl quickly | One ring, on the right token; no warnings | Pass 2026-10-16 |
