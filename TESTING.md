# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the Dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`). After a Dev rebuild, reload the room (the background page loads once per room).

**When:** a PR that needs Owlbear gets its own short list in its PR description. Before tagging a release, run this whole checklist and record the result (date, or the failure) in the last column. A new feature adds its rows here when it merges.

The per-PR checklists for v0.1 (PRs 1–4) are in git history (`git log -p -- TESTING.md`).

## Release checklist (current as of v0.2.0)

v0.1.0 was room-tested PR by PR (the old lists in git history plus checks on #7–#9), not with this list as a whole. First full end-to-end pass: 2026-10-17 (Dev, GM + player), all rows passed.

### Tracker

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 1 | GM: right-click tokens on the map → "Add / Remove Initiative" (a multi-select too); right-click one again | Added in order; a second click removes it. The player's right-click has no such item | 2026-10-17 |
| 2 | GM: click a roll number, type, Enter; add a note (hover the row to see "Add a note") | Both save; the player sees them live, with no inputs | 2026-10-17 |
| 3 | GM: Sort (☰) | Highest roll first, unrolled last | 2026-10-17 |
| 4 | GM: hover a row; drag it by its grip; focus a grip, Space, ↓, Space | Grip and ⋯ appear on hover; the row moves and stays; the player follows. On a touch screen grip and ⋯ always show | 2026-10-17 |
| 5 | GM: right-click a row (or ⋯) → Mark as monster; click, Shift-click, Cmd-click rows, then right-click inside the selection | Monsters move into the GM / Monsters card ("Monsters · N", smaller portraits); the menu acts on all selected rows | 2026-10-17 |
| 6 | GM: row menu → Mark dead on the current token; ▶ through a round | The turn passes on; the dead row fades with a skull and is skipped | 2026-10-17 |
| 7 | GM: delete a tracked token from the map (current, and not current) | It drops out; if current, the turn and ring pass on | 2026-10-17 |
| 8 | GM: type the monsters' DEX (+2) in the GM row; click its d20 | The roll fills with d20 + 2; typing "2" shows "+2" | 2026-10-17 |
| 9 | **Size:** 40 tokens (copy-paste one token until 40), all added, the note below in every note, a few dead, Combat with clear rolls on | No "Couldn't save"; a reload shows everything | 2026-10-17 |

Note for row 9 (200 characters):

```
Note-test-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-K
```

### Turns, marker and hotkeys

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 10 | GM: fresh map; ▶ through two rounds; ◀ once | "Not started" beside the title, then "Round 1", "Round 2"; ◀ greyed before the first ▶ | 2026-10-17 |
| 11 | GM: ▶ onto a player's token; move, resize and rotate it | A gold ring follows it; the token is selected on the GM's screen | 2026-10-17 |
| 12 | GM: ▶ onto GM / Monsters, and onto a monster in combat | No ring (unless that monster's turn marker is on) | 2026-10-17 |
| 13 | GM: hide the current token (Owlbear visibility), then show it | GM sees the ring faded like the token; the player never sees a hidden token or its ring | 2026-10-17 |
| 14 | GM: click in the panel, then N, N, B; open the row menu and press N; type "n" in a note | Next, next, back; nothing while the menu is open or while typing | 2026-10-17 |
| 15 | GM: ▶ quickly several times, switch Combat / Crawl quickly | One ring, on the right token; no warnings | 2026-10-17 |

### Crawling: standard checks

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 16 | GM, Standard, Unsafe: ▶ through 3 crawl rounds | The roll button is plain, then outlined in round 3, filled on the GM / Monsters turn; "Due this round" in the accent color | 2026-10-17 |
| 17 | GM: Roll check; Undo | Big result: the die, then "No encounter" or a red "Encounter!"; Undo clears it | 2026-10-17 |
| 18 | GM: an extra roll in round 2 (Unsafe) | It rolls, but the check is still due in round 3 | 2026-10-17 |
| 19 | GM: R when no roll is due; R when one is | Nothing, then the roll | 2026-10-17 |
| 20 | GM: Risky, Deadly, Darkness | Checks every 2 rounds, every round, every round | 2026-10-17 |

### Crawling: the Crawling Clock

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 21 | GM: Settings → Crawling Clock; open "Crawling Clock rules" | The card shows the d20 dial at 20; the rules sheet opens | 2026-10-17 |
| 22 | GM: ▶ to the GM turn; Roll d6 | Dice chips, "= total", "Clock 20 → N"; a 6 rolls again and adds; the dial empties to N | 2026-10-17 |
| 23 | GM: Darkness; roll | The die is a d8 | 2026-10-17 |
| 24 | GM: get the clock to 5 or lower | An amber "Omen · N" chip and an amber ring | 2026-10-17 |
| 25 | GM: roll past 0 (clock 3, roll 5) | Red "Encounter!" with "Next clock 18" | 2026-10-17 |
| 26 | GM: Combat with the clock at 9, then Crawl | Still 9 (fights never reset the clock) | 2026-10-17 |
| 27 | GM: Reset clock → Cancel; → Reset; right-click the dial → Reset | Cancel keeps it; Reset puts it back to 20 | 2026-10-17 |
| 28 | Switch to another map and back | Each map keeps its own clock, danger level and darkness | 2026-10-17 |

### Combat

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 29 | GM: Combat (player's panel closed) | "Roll for combat initiative" pops up for GM and player; rolls clear; no crawl card | 2026-10-17 |
| 30 | GM: rolls, GM d20, Sort, ▶ through a round | GM / Monsters, then each living monster, then the next player; combat rounds don't count toward checks | 2026-10-17 |
| 31 | GM: Crawl; Remove monsters → Remove | Order and rolls stay; monsters and the DEX box clear; Remove monsters isn't offered in Combat | 2026-10-17 |
| 32 | Player: reload during combat | No alert on reload | 2026-10-17 |

### Settings and panel

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 33 | GM: gear | Cards: Encounters (segmented pill), What players see, Turns and combat, About; switches on the right; the how-to card opens the guide in a new tab | 2026-10-17 |
| 34 | GM: each switch (hide rounds, hide clock / show danger, clear rolls, turn marker, select token, roll automatically) | Each does what its line says; the turn marker switch adds or removes the ring at once | 2026-10-17 |
| 35 | GM: Reset rounds → Cancel; → Reset | Cancel changes nothing; Reset says checks start over and zeroes both counts | 2026-10-17 |
| 36 | Overflow the list; drag the bottom grip; close and reopen | Header and controls stay put, only the list scrolls; the height is kept | 2026-10-17 |
| 37 | Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); the URL is this build's manifest | 2026-10-17 |

### Players and themes

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 38 | Player: the panel | Phase pill with the round (unless hidden), a card with the small d20 clock (unless hidden) and / or danger level (if shown); no gear, grips or checkboxes (the monster fold is theirs) | 2026-10-17 |
| 39 | Owlbear light theme, then dark | The panel follows: text, chips, amber, gold dot and switches readable in both | 2026-10-17 |
| 40 | Toolbar | The Keeper's key icon (Dev: with a dot); one icon and one alert per client after reinstalling | 2026-10-17 |

### New in v0.1.1

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 41 | GM: Crawl, standard, Unsafe; ▶ through 3 crawl rounds; click the d6; Undo | The d20 counts 3 → 2 → 1 → "!", ring segments fill; the card lights on the GM turn; the d6 shows the pips, "No encounter" / red "Encounter!" under it; Undo clears it | 2026-10-17 |
| 42 | GM: danger dropdown to Deadly; switch to Crawling Clock, Darkness, roll; switch back | Deadly: one segment (every round), no darkness switch in standard; clock mode: the d20 shows the clock (no label under it), Darkness makes it "Roll d8", the d6 shows its total and "Clock 20 → N"; back in standard the d6 doesn't show the clock roll | 2026-10-17 |
| 43 | GM: the GM row's d20 → − / + / type a DEX → Roll d20+N | The row opens under the GM row; Roll fills the roll and shows `d20 X + N` under the name; typing a roll by hand drops it | 2026-10-17 |
| 44 | GM: tick checkboxes on two rows; right-click one | Both tinted and in the menu; checkboxes stay visible while any is ticked | 2026-10-17 |
| 45 | GM and player: fold the monsters; reload; Combat, ▶ to a monster | Folded ("N monsters" + portraits), still folded after reload; opens on a monster's turn, folds again after | 2026-10-17 |
| 46 | GM: Mark dead on a token, hide it, show it, Mark alive; mark another dead and Remove from initiative | A skull badge over the token's centre, hidden with it for the player; gone when alive or removed | 2026-10-17 |
| 47 | Player: their own token's turn (a token they placed), then someone else's | "Your turn, <name>" strip, then none | 2026-10-17 |
| 49 | GM: Settings → Show the rolls to players; roll in each mode | The player's card shows the die and its result (with the clock hidden too); off: no roll | 2026-10-17 |
| 50 | GM: Reset rounds / Remove monsters | Under the turn bar, above the list; each asks first | 2026-10-17 |
| 48 | Any view, both themes | No broken styles or missing portraits (the new CSP); browser console has no CSP errors | 2026-10-17 |

### New: Follow Torchlight (Torchlight installed too)

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 51 | Torchlight: light a torch on a tracked token; a lantern; a Light spell | A flame (blue for the spell) beside the name for GM and player; hover names the source | |
| 52 | Standard, Risky: put out every light on tracked tokens | Danger goes Deadly, a Darkness chip shows; each party token without a light gets a small 3 ft light (players see their own token) | |
| 53 | Light one torch again | Back to Risky, chip gone, the 3 ft lights come off (the lit token keeps its torch) | |
| 54 | Crawling Clock: lights out, then back | The torch toggle flips to Darkness (Roll d8) and back | |
| 55 | Settings → Follow Torchlight off; put out the lights | Nothing changes on its own; the 3 ft lights come off | |
| 56 | A room without Torchlight | Never goes dark on its own | |

### New in v0.2.0

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 57 | GM: ▶, then "Undo: Next turn", Redo; Cmd+Z, Shift+Cmd+Z (not while typing in a note) | The bar names the step; the turn and ring go back and forward | 2026-10-31 |
| 58 | GM: close the panel, right-click a token → Add / Remove Initiative, reopen | "Undo: Add to initiative" in the bar; Undo takes it out | |
| 59 | GM: Remove monsters (or Reset rounds, Reset clock) | A "Done: …" toast with Undo just above the bar, never over it, gone after 8 s; its Undo brings them back | 2026-10-31 |
| 60 | GM: a step on map A, open map B, Undo | "… on another map. Skipped."; map B unchanged | |
| 61 | Player: the panel | No Undo bar or toast | |
| 62 | GM: Settings → Manual; ▶ to the GM turn when a check is due; roll the d6; ▶ past it once without rolling | The card shows the danger level and lights up; the d6 rolls a check; ▶ counts a due check made. Player (Show the danger level on): "Crawling · <danger>", never the roll; "Show the rolls" isn't offered | |
| 63 | GM: Settings → Clock 2d20; roll until the clock passes 20 and 0 | Starts at 40, worn down one d20 at a time; the omen and the encounter on the last die; the overflow carries into a fresh 40. Player: "Crawling Clock", "The clock is at N" of 40 | |
| 64 | GM: Settings at a short and a tall panel height; pick each of Interval / Clock 1d20 / Clock 2d20 / Manual | Cards like the web toolkit (Encounters, Darkness, What players see, Turns and combat, About); one scrollbar only; each choice is one undo step | 2026-10-31 |
| 65 | Player: a clock mode with the clock shown | The card's title reads "Crawling Clock" | 2026-10-31 |
