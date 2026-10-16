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
| 1 | GM: open the panel on a fresh map | Crawl selected, "Press ▶ to begin", ◀ greyed out; player sees "Crawl" | |
| 2 | GM: ▶ through two rounds, ◀ once | Round count goes up on wrap and back on ◀; player follows | |
| 3 | GM: Combat (player's panel closed) | "ROLL FOR COMBAT INITIATIVE" pops up for both GM and player; rolls cleared; "Press ▶ to begin" | |
| 4 | GM: enter rolls, sort, ▶ | Round 1 (combat); player sees "Combat" and Round 1 | |
| 5 | GM: Crawl | Combat order and rolls stay; crawl round count as before combat; no alert | |
| 6 | Player: reload during combat | No alert on reload | |
| 7 | GM: gear → turn off "Clear initiative rolls on combat"; back; Combat | Rolls kept; alert still shows | |
| 8 | GM: gear → "Hide rounds from players" | Player sees Crawl / Combat but no round count | |
| 9 | Player | No gear, no buttons | |
| 10 | Size: the 40-token map from PR 1, Combat with clear rolls on | Saves without "Couldn't save" | |
| 11 | GM: drag a row by its ≡ grip (mouse; and on the iPad, touch) | Row moves and stays; player follows. Player has no grip | |
| 12 | GM: focus a grip, Space, ↓, Space | Row moves down one | |
| 13 | GM: gear → Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); pasted URL is the Dev manifest | |
| 14 | After removing and re-adding the Dev extension | One toolbar icon; one combat alert per client | |
| 15 | GM: Reset rounds → Cancel; then Reset rounds → Reset | Cancel changes nothing; Reset puts both counts to 0 and "Press ▶ to begin", rolls and order kept | |
