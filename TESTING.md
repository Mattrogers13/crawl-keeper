# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the Dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`). After a Dev rebuild, reload the room (the background page loads once per room).

**When:** a PR that needs Owlbear gets its own short list in its PR description. Before tagging a release, run this whole checklist and record the result (date, or the failure) in the last column. A new feature adds its rows here when it merges.

The per-PR checklists for v0.1 (PRs 1–4) are in git history (`git log -p -- TESTING.md`).

## Release checklist (current as of v0.1.0)

v0.1.0 was room-tested PR by PR (the old lists in git history plus checks on #7–#9), not with this list as a whole. Fill in "Last pass" (a date) the first time it's run end to end.

### Tracker

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 1 | GM: right-click tokens on the map → "Add / Remove Initiative" (a multi-select too); right-click one again | Added in order; a second click removes it. The player's right-click has no such item |  |
| 2 | GM: click a roll number, type, Enter; add a note (hover the row to see "Add a note") | Both save; the player sees them live, with no inputs |  |
| 3 | GM: Sort (☰) | Highest roll first, unrolled last |  |
| 4 | GM: hover a row; drag it by its grip; focus a grip, Space, ↓, Space | Grip and ⋯ appear on hover; the row moves and stays; the player follows. On a touch screen grip and ⋯ always show |  |
| 5 | GM: right-click a row (or ⋯) → Mark as monster; click, Shift-click, Cmd-click rows, then right-click inside the selection | Monsters move into the GM / Monsters card ("Monsters · N", smaller portraits); the menu acts on all selected rows |  |
| 6 | GM: row menu → Mark dead on the current token; ▶ through a round | The turn passes on; the dead row fades with a skull and is skipped |  |
| 7 | GM: delete a tracked token from the map (current, and not current) | It drops out; if current, the turn and ring pass on |  |
| 8 | GM: type the monsters' DEX (+2) in the GM row; click its d20 | The roll fills with d20 + 2; typing "2" shows "+2" |  |
| 9 | **Size:** 40 tokens (copy-paste one token until 40), all added, the note below in every note, a few dead, Combat with clear rolls on | No "Couldn't save"; a reload shows everything |  |

Note for row 9 (200 characters):

```
Note-test-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-K
```

### Turns, marker and hotkeys

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 10 | GM: fresh map; ▶ through two rounds; ◀ once | "Not started" beside the title, then "Round 1", "Round 2"; ◀ greyed before the first ▶ |  |
| 11 | GM: ▶ onto a player's token; move, resize and rotate it | A gold ring follows it; the token is selected on the GM's screen |  |
| 12 | GM: ▶ onto GM / Monsters, and onto a monster in combat | No ring (unless that monster's turn marker is on) |  |
| 13 | GM: hide the current token (Owlbear visibility), then show it | GM sees the ring faded like the token; the player never sees a hidden token or its ring |  |
| 14 | GM: click in the panel, then N, N, B; open the row menu and press N; type "n" in a note | Next, next, back; nothing while the menu is open or while typing |  |
| 15 | GM: ▶ quickly several times, switch Combat / Crawl quickly | One ring, on the right token; no warnings |  |

### Crawling: standard checks

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 16 | GM, Standard, Unsafe: ▶ through 3 crawl rounds | The roll button is plain, then outlined in round 3, filled on the GM / Monsters turn; "Due this round" in the accent color |  |
| 17 | GM: Roll check; Undo | Big result: the die, then "No encounter" or a red "Encounter!"; Undo clears it |  |
| 18 | GM: an extra roll in round 2 (Unsafe) | It rolls, but the check is still due in round 3 |  |
| 19 | GM: R when no roll is due; R when one is | Nothing, then the roll |  |
| 20 | GM: Risky, Deadly, Darkness | Checks every 2 rounds, every round, every round |  |

### Crawling: the Crawling Clock

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 21 | GM: Settings → Crawling Clock; open "Crawling Clock rules" | The card shows the d20 dial at 20; the rules sheet opens |  |
| 22 | GM: ▶ to the GM turn; Roll d6 | Dice chips, "= total", "Clock 20 → N"; a 6 rolls again and adds; the dial empties to N |  |
| 23 | GM: Darkness; roll | The die is a d8 |  |
| 24 | GM: get the clock to 5 or lower | An amber "Omen · N" chip and an amber ring |  |
| 25 | GM: roll past 0 (clock 3, roll 5) | Red "Encounter!" with "Next clock 18" |  |
| 26 | GM: Combat with the clock at 9, then Crawl | Still 9 (fights never reset the clock) |  |
| 27 | GM: Reset clock → Cancel; → Reset; right-click the dial → Reset | Cancel keeps it; Reset puts it back to 20 |  |
| 28 | Switch to another map and back | Each map keeps its own clock, danger level and darkness |  |

### Combat

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 29 | GM: Combat (player's panel closed) | "Roll for combat initiative" pops up for GM and player; rolls clear; no crawl card |  |
| 30 | GM: rolls, GM d20, Sort, ▶ through a round | GM / Monsters, then each living monster, then the next player; combat rounds don't count toward checks |  |
| 31 | GM: Crawl; Remove monsters → Remove | Order and rolls stay; monsters and the DEX box clear; Remove monsters isn't offered in Combat |  |
| 32 | Player: reload during combat | No alert on reload |  |

### Settings and panel

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 33 | GM: gear | Cards: Encounters (segmented pill), What players see, Turns and combat, About; switches on the right; the how-to card opens the guide in a new tab |  |
| 34 | GM: each switch (hide rounds, hide clock / show danger, clear rolls, turn marker, select token, roll automatically) | Each does what its line says; the turn marker switch adds or removes the ring at once |  |
| 35 | GM: Reset rounds → Cancel; → Reset | Cancel changes nothing; Reset says checks start over and zeroes both counts |  |
| 36 | Overflow the list; drag the bottom grip; close and reopen | Header and controls stay put, only the list scrolls; the height is kept |  |
| 37 | Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); the URL is this build's manifest |  |

### Players and themes

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 38 | Player: the panel | Phase chip, round (unless hidden), the small d20 clock (unless hidden) or danger level (if shown); no gear, no buttons, no grips |  |
| 39 | Owlbear light theme, then dark | The panel follows: text, chips, amber, gold dot and switches readable in both |  |
| 40 | Toolbar | The Keeper's key icon (Dev: with a dot); one icon and one alert per client after reinstalling |  |
