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

## PR 3: monsters, HP, turn marker, select the current token (v0.1, 2026-10-16)

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM: right-click two monster tokens → "Add / Remove Monster" (claw icon) | Listed indented under GM / Monsters, no roll box; player sees them (unless hidden) | |
| 2 | GM: right-click one of them → "Add / Remove Initiative" | It switches to a player row with a roll box; HP gone | |
| 3 | GM: drag monsters within the group; drag the GM row among players | Monsters reorder in the group only and travel with the GM row; Sort leaves the monsters' order alone | |
| 4 | GM: ▶ through a round | GM / Monsters, then each living monster in order, then the next player; dead monsters skipped | |
| 5 | GM: ▶ onto a token | Gold ring (a bit bigger than the token) around it; the token is selected on the GM's screen | |
| 6 | GM: ▶ onto GM / Monsters | Ring disappears; selection unchanged | |
| 7 | GM: move, resize and rotate the current token | Ring follows position and size, stays upright | |
| 8 | GM: a hidden monster's turn | GM sees the ring (faded like the token); player sees neither the monster nor the ring, and the GM row shows as current | |
| 9 | GM: delete the current token from the map | Ring goes with it | |
| 10 | GM: right-click → remove the current token | Turn and ring pass on | |
| 11 | Player | Ring visible on visible tokens; can't select or move it | |
| 12 | GM: gear → turn marker off, then on | Ring disappears at once, comes back on the current token | |
| 13 | GM: gear → Select the current token off; ▶ | Turn moves, selection doesn't | |
| 14 | GM: monster HP max 20; current "-7", then "+3", then "abc" | 13, then 16; "abc" puts 16 back. Players' rows have no HP; player sees no HP anywhere | |
| 15 | GM: monster HP to 0 | Shows red; nothing else happens | |
| 16 | Size: the 40-token map; make most of them monsters with HP; Combat | Saves without "Couldn't save" | |
