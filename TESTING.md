# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the Dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`). After a Dev rebuild, reload the room (the background page loads once per room).

**When:** a PR that needs Owlbear gets its own short list in its PR description. Before tagging a release, run this whole checklist and record the result (date, or the failure) in the last column. A new feature adds its rows here when it merges.

The per-PR checklists for v0.1 (PRs 1–4) are in git history (`git log -p -- TESTING.md`).

## Release checklist (current as of v0.3.0)

v0.1.0 was room-tested PR by PR (the old lists in git history plus checks on #7–#9), not with this list as a whole. First full end-to-end pass: 2026-10-17 (Dev, GM + player), all rows passed. v0.3.0 full pass: 2026-11-01 to 2026-11-02 (Dev `4fd459d`, GM + player, Dynamic Fog, Torchlight uninstalled), all rows passed (51–55 retired).

### Tracker

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 1 | GM: right-click tokens on the map → "Add / Remove Initiative" (a multi-select too); right-click one again | Added in order; a second click removes it. The player's right-click has no such item | 2026-11-01 |
| 2 | GM: click a roll number, type, Enter; add a note (hover the row to see "Add a note") | Both save; the player sees them live, with no inputs | 2026-11-01 |
| 3 | GM: Sort (☰) | Highest roll first, unrolled last | 2026-11-01 |
| 4 | GM: hover a row; drag it by its grip; focus a grip, Space, ↓, Space | Grip and ⋯ appear on hover; the row moves and stays; the player follows. On a touch screen grip and ⋯ always show | 2026-11-01 |
| 5 | GM: right-click a row (or ⋯) → Mark as monster; click, Shift-click, Cmd-click rows, then right-click inside the selection | Monsters move into the GM / Monsters card ("Monsters · N", smaller portraits); the menu acts on all selected rows | 2026-11-01 |
| 6 | GM: row menu → Mark dead on the current token; ▶ through a round | The turn passes on; the dead row fades with a skull and is skipped | 2026-11-01 |
| 7 | GM: delete a tracked token from the map (current, and not current) | It drops out; if current, the turn and ring pass on | 2026-11-01 |
| 8 | GM: type the monsters' DEX (+2) in the GM row; click its d20 | The roll fills with d20 + 2; typing "2" shows "+2" | 2026-11-01 |
| 9 | **Size:** 40 tokens (copy-paste one token until 40), all added, the note below in every note, a few dead, Combat with clear rolls on | No "Couldn't save"; a reload shows everything | 2026-11-01 |

Note for row 9 (200 characters):

```
Note-test-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-K
```

### Turns, marker and hotkeys

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 10 | GM: fresh map; ▶ through two rounds; ◀ once | "Not started" beside the title, then "Round 1", "Round 2"; ◀ greyed before the first ▶ | 2026-11-02 |
| 11 | GM: ▶ onto a player's token; move, resize and rotate it | A gold ring follows it; the token is selected on the GM's screen | 2026-11-02 |
| 12 | GM: ▶ onto GM / Monsters, and onto a monster in combat | No ring (unless that monster's turn marker is on) | 2026-11-02 |
| 13 | GM: hide the current token (Owlbear visibility), then show it | GM sees the ring faded like the token; the player never sees a hidden token or its ring | 2026-11-02 |
| 14 | GM: click in the panel, then N, N, B; open the row menu and press N; type "n" in a note | Next, next, back; nothing while the menu is open or while typing | 2026-11-02 |
| 15 | GM: ▶ quickly several times, switch Combat / Crawl quickly | One ring, on the right token; no warnings | 2026-11-02 |

### Crawling: standard checks

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 16 | GM, Standard, Unsafe: ▶ through 3 crawl rounds | The roll button is plain, then outlined in round 3, filled on the GM / Monsters turn; "Due this round" in the accent color | 2026-11-02 |
| 17 | GM: Roll check; Undo | Big result: the die, then "No encounter" or a red "Encounter!"; Undo clears it | 2026-11-02 |
| 18 | GM: an extra roll in round 2 (Unsafe) | It rolls, but the check is still due in round 3 | 2026-11-02 |
| 19 | GM: R when no roll is due; R when one is | Nothing, then the roll | 2026-11-02 |
| 20 | GM: Risky, Deadly, Darkness | Checks every 2 rounds, every round, every round | 2026-11-02 |

### Crawling: the Crawling Clock

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 21 | GM: Settings → Crawling Clock; open "Crawling Clock rules" | The card shows the d20 dial at 20; the rules sheet opens | 2026-11-02 |
| 22 | GM: ▶ to the GM turn; Roll d6 | Dice chips, "= total", "Clock 20 → N"; a 6 rolls again and adds; the dial empties to N | 2026-11-02 |
| 23 | GM: Darkness; roll | The die is a d8 | 2026-11-02 |
| 24 | GM: get the clock to 5 or lower | An amber "Omen · N" chip and an amber ring | 2026-11-02 |
| 25 | GM: roll past 0 (clock 3, roll 5) | Red "Encounter!" with "Next clock 18" | 2026-11-02 |
| 26 | GM: Combat with the clock at 9, then Crawl | Still 9 (fights never reset the clock) | 2026-11-02 |
| 27 | GM: Reset clock → Cancel; → Reset; right-click the dial → Reset | Cancel keeps it; Reset puts it back to 20 | 2026-11-02 |
| 28 | Switch to another map and back | Each map keeps its own clock, danger level and darkness | 2026-11-02 |

### Combat

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 29 | GM: Combat (player's panel closed) | "Roll for combat initiative" pops up for GM and player; rolls clear; no crawl card | 2026-11-02 |
| 30 | GM: rolls, GM d20, Sort, ▶ through a round | GM / Monsters, then each living monster, then the next player; combat rounds don't count toward checks | 2026-11-02 |
| 31 | GM: Crawl; Remove monsters → Remove | Order and rolls stay; monsters and the DEX box clear; Remove monsters isn't offered in Combat | 2026-11-02 |
| 32 | Player: reload during combat | No alert on reload | 2026-11-02 |

### Settings and panel

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 33 | GM: gear | Cards: Encounters (segmented pill), Darkness, Players' lights (v0.3), What players see, Turns and combat, About; switches on the right; the how-to card opens the guide in a new tab | 2026-11-02 |
| 34 | GM: each switch (hide rounds, hide clock / show danger, clear rolls, turn marker, select token, roll automatically) | Each does what its line says; the turn marker switch adds or removes the ring at once | 2026-11-02 |
| 35 | GM: Reset rounds → Cancel; → Reset | Cancel changes nothing; Reset says checks start over and zeroes both counts | 2026-11-02 |
| 36 | Overflow the list; drag the bottom grip; close and reopen | Header and controls stay put, only the list scrolls; the height is kept | 2026-11-02 |
| 37 | Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); the URL is this build's manifest | 2026-11-02 |

### Players and themes

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 38 | Player: the panel | Phase pill with the round (unless hidden), a card with the small d20 clock (unless hidden) and / or danger level (if shown); no gear, grips or checkboxes (the monster fold is theirs) | 2026-11-02 |
| 39 | Owlbear light theme, then dark | The panel follows: text, chips, amber, gold dot and switches readable in both | 2026-11-02 |
| 40 | Toolbar | The Keeper's key icon (Dev: with a dot); one icon and one alert per client after reinstalling | 2026-11-02 |

### New in v0.1.1

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 41 | GM: Crawl, standard, Unsafe; ▶ through 3 crawl rounds; click the d6; Undo | The d20 counts 3 → 2 → 1 → "!", ring segments fill; the card lights on the GM turn; the d6 shows the pips, "No encounter" / red "Encounter!" under it; Undo clears it | 2026-11-02 |
| 42 | GM: danger dropdown to Deadly; switch to Crawling Clock, Darkness, roll; switch back | Deadly: one segment (every round); the Torchlit / Darkness switch is on the card in every mode (v0.3); clock mode: the d20 shows the clock (no label under it), Darkness makes it "Roll d8", the d6 shows its total and "Clock 20 → N"; back in standard the d6 doesn't show the clock roll | 2026-11-02 |
| 43 | GM: the GM row's d20 → − / + / type a DEX → Roll d20+N | The row opens under the GM row; Roll fills the roll and shows `d20 X + N` under the name; typing a roll by hand drops it | 2026-11-02 |
| 44 | GM: tick checkboxes on two rows; right-click one | Both tinted and in the menu; checkboxes stay visible while any is ticked | 2026-11-02 |
| 45 | GM and player: fold the monsters; reload; Combat, ▶ to a monster | Folded ("N monsters" + portraits), still folded after reload; opens on a monster's turn, folds again after | 2026-11-02 |
| 46 | GM: Mark dead on a token, hide it, show it, Mark alive; mark another dead and Remove from initiative | A skull badge over the token's centre, hidden with it for the player; gone when alive or removed | 2026-11-02 |
| 47 | Player: their own token's turn (a token they placed), then someone else's | "Your turn, <name>" strip, then none | 2026-11-02 |
| 49 | GM: Settings → Show the rolls to players; roll in each mode | The player's card shows the die and its result (with the clock hidden too); off: no roll | 2026-11-02 |
| 50 | GM: Reset rounds / Remove monsters | Under the turn bar, above the list; each asks first | 2026-11-02 |
| 48 | Any view, both themes | No broken styles or missing portraits (the new CSP); browser console has no CSP errors | 2026-11-02 |

### New: Follow Torchlight (Torchlight installed too)

Rows 51–55 retired (Matt, 2026-10-31): the Torchlight merge (v0.3) replaces Follow Torchlight, so they aren't room-tested for v0.2. Row 56 stays: it covers every room without Torchlight.

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 51 | Torchlight: light a torch on a tracked token; a lantern; a Light spell | A flame (blue for the spell) beside the name for GM and player; hover names the source | Retired (v0.3) |
| 52 | Standard, Risky: put out every light on tracked tokens | Danger goes Deadly, a Darkness chip shows; each party token without a light gets a small 3 ft light (players see their own token) | Retired (v0.3) |
| 53 | Light one torch again | Back to Risky, chip gone, the 3 ft lights come off (the lit token keeps its torch) | Retired (v0.3) |
| 54 | Crawling Clock: lights out, then back | The torch toggle flips to Darkness (Roll d8) and back | Retired (v0.3) |
| 55 | Settings → Follow Torchlight off; put out the lights | Nothing changes on its own; the 3 ft lights come off | Retired (v0.3) |
| 56 | A room with no lights in the Light Tracker (v0.3: was "without Torchlight") | Never goes dark on its own; only the card's switch darkens it | 2026-11-02 |

### New in v0.2.0

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 57 | GM: ▶, then "Undo: Next turn", Redo; Cmd+Z, Shift+Cmd+Z (not while typing in a note) | The bar names the step; the turn and ring go back and forward | 2026-11-02 |
| 58 | GM: close the panel, right-click a token → Add / Remove Initiative, reopen | "Undo: Add to initiative" in the bar; Undo takes it out | 2026-11-02 |
| 59 | GM: Remove monsters (or Reset rounds, Reset clock) | A "Done: …" toast with Undo just above the bar, never over it, gone after 8 s; its Undo brings them back | 2026-11-02 |
| 60 | GM: a step on map A, open map B, Undo | "… on another map. Skipped."; map B unchanged | 2026-11-02 |
| 61 | Player: the panel | No Undo bar or toast | 2026-11-02 |
| 62 | GM: Settings → Manual; ▶ to the GM turn when a check is due; roll the d6; ▶ past it once without rolling | The card shows the danger level and lights up; the d6 rolls a check; ▶ counts a due check made. Player (Show the danger level on): "Crawling · <danger>", never the roll; "Show the rolls" isn't offered | 2026-11-02 |
| 63 | GM: Settings → Clock 2d20; roll until the clock passes 20 and 0 | Starts at 40, worn down one d20 at a time; the omen and the encounter on the last die; the overflow carries into a fresh 40. Player: "Crawling Clock", "The clock is at N" of 40 | 2026-11-02 |
| 64 | GM: Settings at a short and a tall panel height; pick each of Interval / Clock 1d20 / Clock 2d20 / Manual | Cards like the web toolkit (Encounters, Darkness, Players' lights, What players see, Turns and combat, About); one scrollbar only; each choice is one undo step | 2026-11-02 |
| 65 | Player: a clock mode with the clock shown | The card's title reads "Crawling Clock" | 2026-11-02 |

### New in v0.3.0 (the Torchlight merge)

Torchlight uninstalled. Dynamic Fog on for rows 72–74. Rows 66–76 sum up the per-PR room tests of #28–#35.

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 66 | GM: a row's menu → Give torch; the same menu again; the flame beside the gear | The strip and a counting badge on the row; the menu reads "Put out the torch, light the lantern"; the Light Tracker lists "Torch · <name>" | 2026-11-02 |
| 67 | GM, Light Tracker: Time passes `10m` (and `abc`); click a time, type `31:00`; Pause and resume; switch Ride along / Separate and light a second token | Lit lights lose 10 min, `abc` is explained; the time is corrected; times freeze while paused; Ride along matches the first timer, Separate starts a full hour. Everyone gets "Time passes: 10 minutes." | 2026-11-02 |
| 68 | GM: put out a torch (badge or Light Tracker); a lantern at 0:40 left, put out, light again | The torch is spent; the lantern keeps 0:30 and lights again from there | 2026-11-02 |
| 69 | GM: Put lights out, then the toast's Undo; Undo / Redo a light change | All out, red strip "No light · total darkness"; Undo brings them back; each step names itself | 2026-11-02 |
| 70 | GM: every light out, Follow light on; Interval, then a clock mode; light one again | Red "Total darkness" on the crawl card, a check every crawl round, the switch reads "Darkness · following light" and is locked, DIS on living players' rows (player sees it too), the danger level unchanged; clocks roll a d8; one light clears it all | 2026-11-02 |
| 71 | GM: Remove all lights, press the card's switch; then Settings → Follow light off, light and put out a light | The switch unlocks and darkens by hand; with Follow light off, lights never darken the map | 2026-11-02 |
| 72 | GM: right-click a party token → Crawl Keeper → Light torch, Light lantern, Put out; a token outside initiative; a prop; several tokens at once | 30 ft light, then 60 ft (the torch spent), then back to 3 ft; badge icons on the token; no row added for the outside token; a prop offers only Light campfire (no icon); each selected token lit; Undo moves the map light back | 2026-11-02 |
| 73 | GM: a token with its own Dynamic Fog light: light a torch, put it out | Its own light comes back | 2026-11-02 |
| 74 | Player: their party token, lights out | A 3 ft dim light shows their token through the fog | 2026-11-02 |
| 75 | GM: Settings → Players light their own on. Player: right-click their token → Crawl Keeper → Light torch; the flame in their header → Your light → Light lantern (asks first), Put out; GM leaves the room, player tries again | Each works and the GM sees it; the swap asks; without the GM: "The GM isn't in the room". GM lights an NPC torch after the player's, then Undo: the player's torch stays | 2026-11-02 |
| 76 | Player: Settings → Show lights to players off, then on; a light burns out (set one to `0:05`) | Off: only their Your light card; on: party light, every light, badges, DIS. Everyone gets the burn-out notice; the strip says "<light> burned out" | 2026-11-02 |
