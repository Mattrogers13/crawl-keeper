# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`).

## PR 1: tracker core (v0.1, 2026-10-15)

| # | Steps | Expect | Result |
|---|---|---|---|
| 1 | GM: right-click a character token | "Add / Remove Initiative" appears; player's right-click doesn't show it | |
| 2 | GM: add 3 tokens (one multi-select click works too); right-click one again | Added in that order under the GM / Monsters row; second click removes it | |
| 3 | GM: type rolls, Enter / click away; add notes | Saved; player sees rolls and notes live (no inputs, no buttons) | |
| 4 | GM: Sort (d20 order) | Highest roll first, unrolled last | |
| 5 | GM: Start, Next through a full round, Previous | Current row highlighted for both; round ticks on wrap | |
| 6 | GM: Table order; set rolls so a middle seat is highest; Start | Highest roll goes first ("first" tag), then down the list and wraps | |
| 7 | GM: Hide round | Player sees "In progress" instead of the round | |
| 8 | GM: hide a monster token (Owlbear visibility), make it its turn | Player doesn't see the monster; GM / Monsters row shows as current for the player | |
| 9 | GM: delete a tracked token from the map | It drops from the list; if it was current, turn passes to the next | |
| 10 | Switch to another scene and back | Each map keeps its own tracker | |
| 11 | Close the scene | Panel says "Open a scene to use the tracker." | |
| 12 | **Scene metadata limit (unverified).** GM: add 40 tokens, 200-character note on each (paste), save | Saves without a "Couldn't save" error. If it fails, record the error text here | |
| 13 | Theme: switch Owlbear light/dark | Panel follows | |
| 14 | Context menu icon | Renders white (SVG is fine for menu icons; Torchlight uses one) | |
