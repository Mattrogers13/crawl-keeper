# Real-room testing

Automated tests run against an in-memory SDK; these checks need real Owlbear. One room, GM in one browser, player in a private window. Install the Dev build: `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (or locally: `npm run dev`, then `http://localhost:5173/manifest.json`). After a Dev rebuild, reload the room (the background page loads once per room).

**When:** a PR that needs Owlbear gets its own short list in its PR description. Before tagging a release, run this whole checklist and record the result (date, or the failure) in the last column. A new feature adds its rows here when it merges.

The per-PR checklists for v0.1 (PRs 1–4) are in git history (`git log -p -- TESTING.md`).

## Release checklist (current as of v0.4.0)

v0.1.0 was room-tested PR by PR (the old lists in git history plus checks on #7–#9), not with this list as a whole. First full end-to-end pass: 2026-10-17 (Dev, GM + player), all rows passed. v0.3.0 full pass: 2026-11-01 to 2026-11-02 (Dev `4fd459d`, GM + player, Dynamic Fog, Torchlight uninstalled), all rows passed (51–55 retired).

### Tracker

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 1 | GM: right-click tokens on the map → "Add / Remove Initiative" (a multi-select too); right-click one again | Added in order; a second click removes it. The player's right-click has no such item | 2026-11-06 |
| 2 | GM: click a roll number, type, Enter; add a note (row menu → Add note; the GM row: hover to see "Add a note"); clear a note | Both save; the player sees them live, with no inputs; a token row with no note has nothing under its name; a cleared note goes | 2026-11-06 |
| 3 | GM: drag a row out of roll order; Sort (☰) | Highest roll first, unrolled last (entering a roll sorts by itself: row 102) | 2026-11-06 |
| 4 | GM: hover a row; drag it by its grip; focus a grip, Space, ↓, Space | Grip and ⋯ appear on hover; the row moves and stays; the player follows. On a touch screen grip and ⋯ always show | 2026-11-06 |
| 5 | GM: right-click a row (or ⋯) → Mark as monster; click, Shift-click, Cmd-click rows, then right-click inside the selection | Monsters move into the GM / Monsters card ("Monsters · N", smaller portraits); the menu acts on all selected rows | 2026-11-06 |
| 6 | GM: row menu → Mark dead on the current token; ▶ through a round | The turn passes on; the dead row fades with a skull and is skipped | 2026-11-06 |
| 7 | GM: delete a tracked token from the map (current, and not current) | It drops out; if current, the turn and ring pass on | 2026-11-06 |
| 8 | GM: type the monsters' DEX (+2) in the GM row; click its d20 | The roll fills with d20 + 2; typing "2" shows "+2" | 2026-11-06 |
| 9 | **Size:** 40 tokens (copy-paste one token until 40), all added, the note below in every note, a few dead, Combat with clear rolls on | No "Couldn't save"; a reload shows everything | 2026-11-06 |

Note for row 9 (200 characters):

```
Note-test-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-KLMNOPQRST-UVWXYZ-0123456789-abcdefghij-klmnopqrst-uvwxyz-ABCDEFGHIJ-K
```

### Turns, marker and hotkeys

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 10 | GM: fresh map; ▶ through two rounds; ◀ once | "Not started" beside the title, then "Round 1", "Round 2"; ◀ greyed before the first ▶ | 2026-11-06 |
| 11 | GM: ▶ onto a player's token; move, resize and rotate it | A gold ring follows it; the token is selected on the GM's screen | 2026-11-06 |
| 12 | GM: ▶ onto GM / Monsters, and onto a monster in combat | No ring (unless that monster's turn marker is on) | 2026-11-06 |
| 13 | GM: hide the current token (Owlbear visibility), then show it | GM sees the ring faded like the token; the player never sees a hidden token or its ring | 2026-11-06 |
| 14 | GM: click in the panel, then N, N, B; open the row menu and press N; type "n" in a note | Next, next, back; nothing while the menu is open or while typing | 2026-11-06 |
| 15 | GM: ▶ quickly several times, switch Combat / Crawl quickly | One ring, on the right token; no warnings | 2026-11-06 |

### Crawling: standard checks

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 16 | GM, Standard, Unsafe: ▶ through 3 crawl rounds | The roll button is plain, then outlined in round 3, filled on the GM / Monsters turn; "check now" in the accent color | 2026-11-06 |
| 17 | GM: Roll check; Undo | The die shows the roll, with "No encounter" or a red "Encounter!" beside it; Undo clears it | 2026-11-06 |
| 18 | GM: an extra roll in round 2 (Unsafe) | It rolls, but the check is still due in round 3 | 2026-11-06 |
| 19 | GM: R when no roll is due; R when one is | Nothing, then the roll | 2026-11-06 |
| 20 | GM: Risky, Deadly, then the card's Darkness switch | Checks every 2 rounds, every round, every round | 2026-11-06 |

### Crawling: the Crawling Clock

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 21 | GM: Settings → Clock 1d20; open "Crawling Clock rules" | The card shows the d20 dial at 20; the rules sheet opens | 2026-11-06 |
| 22 | GM: ▶ to the GM turn; Roll d6 | The die shows the total (a 6 rolls again and adds) with "Clock 20 → N" beside it; the dial empties to N | 2026-11-06 |
| 23 | GM: Darkness; roll | The die is a d8 | 2026-11-06 |
| 24 | GM: get the clock to 5 or lower | An amber "Omen · N" on the card and an amber ring | 2026-11-06 |
| 25 | GM: roll past 0 (clock 3, roll 5) | Red "Encounter!" with "Next clock 18" | 2026-11-06 |
| 26 | GM: Combat with the clock at 9, then Crawl | Still 9 (fights never reset the clock) | 2026-11-06 |
| 27 | GM: Reset clock → Cancel; → Reset; right-click the dial → Reset | Cancel keeps it; Reset puts it back to 20 | 2026-11-06 |
| 28 | Switch to another map and back | Each map keeps its own clock, danger level and darkness | 2026-11-06 |

### Combat

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 29 | GM: Combat (player's panel closed) | "Roll for combat initiative" pops up for GM and player; rolls clear; the crawl card becomes "Combat · encounter checks paused"; the log says "Combat: roll for initiative." | 2026-11-06 |
| 30 | GM: rolls (the list sorts itself), the GM row's d20, ▶ through a round | GM / Monsters, then each living monster, then the next player; combat rounds don't count toward checks | 2026-11-06 |
| 31 | GM: Crawl; Remove monsters → Remove | Order and rolls stay; monsters and the DEX box clear; Remove monsters isn't offered in Combat | 2026-11-06 |
| 32 | Player: reload during combat | No alert on reload | 2026-11-06 |

### Settings and panel

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 33 | GM: gear | The how-to card (opens the guide in a new tab) and the Session log card, then Encounters (segmented pill), Darkness, Players' lights, What players see, Turns and combat (with Show effect icons on the map), About, and Session (Reset all) last; switches on the right. The guide has Effects and Session log and Reset all sections | 2026-11-06 |
| 34 | GM: each switch (hide rounds, hide clock / show danger, show rolls, clear rolls, turn marker, select token, roll automatically) | Each does what its line says; the turn marker switch adds or removes the ring at once; the green eyes on the crawl card follow the What players see switches | 2026-11-06 |
| 35 | GM: Reset rounds → Cancel; → Reset | Cancel changes nothing; Reset says checks start over and zeroes both counts | 2026-11-06 |
| 36 | Overflow the list; drag the bottom grip; close and reopen | Header and controls stay put, only the list scrolls; the height is kept | 2026-11-06 |
| 37 | Install link → Copy | "Copied" (or the text is selected with a Cmd+C hint); the URL is this build's manifest | Retired (v0.4: the install link left Settings; the guide has it) |

### Players and themes

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 38 | Player: the panel | Phase pill with the round (unless hidden), a card with the small d20 clock (unless hidden) and / or danger level (if shown); the scroll (their session log) and the flame; no gear, ⏳, grips or checkboxes (the monster fold is theirs) | 2026-11-06 |
| 39 | Owlbear light theme, then dark | The panel follows: text, chips, amber, gold dot and switches readable in both | 2026-11-06 |
| 40 | Toolbar | The Keeper's key icon (Dev: with a dot); one icon and one alert per client after reinstalling | 2026-11-06 |

### New in v0.1.1

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 41 | GM: Crawl, standard, Unsafe; ▶ through 3 crawl rounds; click the d6; Undo | The d20 counts 3 → 2 → 1 → "!", ring segments fill; the card lights on the GM turn; the d6 shows the pips, "No encounter" / red "Encounter!" beside it; Undo clears it | 2026-11-02 |
| 42 | GM: danger dropdown to Deadly; switch to Crawling Clock, Darkness, roll; switch back | Deadly: one segment (every round); the Torchlit / Darkness switch is on the card in every mode (v0.3); clock mode: the d20 shows the clock (no label under it), Darkness makes it "Roll d8", the d6 shows its total and "Clock 20 → N"; back in standard the d6 doesn't show the clock roll | 2026-11-02 |
| 43 | GM: the GM row's d20 → − / + / type a DEX → Roll d20+N | The row opens under the GM row; Roll fills the roll (the list sorts itself) and shows `d20 X + N` under the name; typing a roll by hand drops it | 2026-11-02 |
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
| 66 | GM: a row's menu → Give torch; the same menu again; the flame beside the gear | A counting badge on the row; the menu reads "Put out the torch, light the lantern"; the Light Tracker lists "Torch · <name>" | 2026-11-02 |
| 67 | GM, Light Tracker: Time passes `10m` (and `abc`); click a time, type `31:00`; Pause and resume; switch Ride along / Separate and light a second token | Lit lights lose 10 min, `abc` is explained; the time is corrected; times freeze while paused; Ride along matches the first timer, Separate starts a full hour. Everyone gets "Time passes: 10 minutes." | 2026-11-02 |
| 68 | GM: put out a torch (badge or Light Tracker); a lantern at 0:40 left, put out, light again | The torch is spent; the lantern keeps 0:30 and lights again from there | 2026-11-02 |
| 69 | GM: Put lights out, then the toast's Undo; Undo / Redo a light change | All out, the notices card says "Total darkness (p. 84)"; Undo brings them back; each step names itself | 2026-11-02 |
| 70 | GM: every light out, Follow light on; Interval, then a clock mode; light one again | "Total darkness" in the notices card, a check every crawl round, the switch reads "Darkness" (tooltip: following light) and is locked, DIS on living players' rows (player sees it too), the danger level unchanged; clocks roll a d8; one light clears it all | 2026-11-02 |
| 71 | GM: Remove all lights, press the card's switch; then Settings → Follow light off, light and put out a light | The switch unlocks and darkens by hand; with Follow light off, lights never darken the map | 2026-11-02 |
| 72 | GM: right-click a party token → Crawl Keeper → Light torch, Light lantern, Put out; a token outside initiative; a prop; several tokens at once | 30 ft light, then 60 ft (the torch spent), then back to 3 ft; badge icons on the token; no row added for the outside token; a prop offers only Light campfire (no icon); each selected token lit; Undo moves the map light back | 2026-11-02 |
| 73 | GM: a token with its own Dynamic Fog light: light a torch, put it out | Its own light comes back | 2026-11-02 |
| 74 | Player: their party token, lights out | A 3 ft dim light shows their token through the fog | 2026-11-02 |
| 75 | GM: Settings → Players light their own on. Player: right-click their token → Crawl Keeper → Light torch; the flame in their header → Your light → Light lantern (asks first), Put out; GM leaves the room, player tries again | Each works and the GM sees it; the swap asks; without the GM: "The GM isn't in the room". GM lights an NPC torch after the player's, then Undo: the player's torch stays | 2026-11-02 |
| 76 | Player: Settings → Show lights to players off, then on; a light burns out (set one to `0:05`) | Off: only their Your light card; on: party light, every light, badges, DIS. Everyone gets the burn-out notice; the GM's notices card says "<light> · <name> burned out" | 2026-11-02 |

### Effects (v0.4)

| # | Steps | Expect | Last pass |
|---|---|---|---|
| 77 | GM: ▶ to a player's turn; right-click their row → Add effect… → "Bless", Rounds 2, Add; ▶ through two rounds | A Bless line under the row, "2 rnd"; 1 (amber) after their next turn starts; "ended" and "Bless on … ends now" in the notices on the turn it ends; gone on the next ▶; ◀ brings it back | 2026-11-05 |
| 78 | GM: Add effect (the link under the turn bar) → "Cloudkill", Roll 1d6; a token not in initiative → Add effect from its row before removing it, or keep one on a removed row | Both in the notices card (folded with a count when there are two), the token's with its name, Cloudkill "· no token" | 2026-11-05 |
| 79 | GM: select two rows → right-click → Add effect to 2… → DIS, Ongoing | A DIS line under each row; the name filled itself | 2026-11-05 |
| 80 | GM: on a caster's row: Add effect… → "Hold Person", Duration Focus. On a monster: "Paralyzed", Duration "While <caster>'s Hold Person lasts". Then Add effect… → "Web", Focus on the caster | ◎ Hold Person line; asks "End Hold Person, focus on Web?"; End and focus: Hold Person and Paralyzed go | 2026-11-05 |
| 81 | GM: ▶ to the caster's turn with a focus: Lost; again with Nat 1; then a focusing monster while crawling; then row menu → Focus check now off their turn → Kept | The focus check in the notices on their turn (a monster's on the GM turn); Lost ends it and what ends with it; Nat 1 adds the critical-failure notice (p. 45); Kept dismisses | 2026-11-05 |
| 82 | GM: Mark dead a focusing caster; Undo. Reset rounds with a rounds effect running. ⏳ → 10m → Pass | Dead ends the focus (and Paralyzed); one Undo brings all back. Reset: the effect keeps its rounds left. Time passes: rounds effects go, focus and Ongoing stay; one Undo brings them back | 2026-11-05 |
| 83 | GM: click an effect line → Rounds left 5 → Set; click again → Remove. Delete a token holding effects from the map | The line reads 5, then goes; the token's effects go (and what ends with its focus) | 2026-11-05 |
| 84 | Player (private window): GM adds a hidden effect, one on a hidden token, one free-standing, and a focus on the player's token | The player sees the effect lines, the notices and their focus check, no buttons, nothing hidden | 2026-11-05 |
| 85 | GM: Bless on a player, Rounds 1, counted on their turn; a hidden one too. ▶ until it ends, ◀, ▶ again. Player (private window, panel closed) watches | On the turn it ends, GM and player get "Bless on <name> ended."; the hidden one only for the GM; ◀ then ▶ doesn't repeat it | 2026-11-05 |
| 86 | GM: add a hidden effect to a row, a hidden DIS, and a hidden free-standing one | Each hidden effect line has a struck-through eye and a dashed outline, light and dark theme; the others don't | 2026-11-05 |
| 87 | GM: panel closed; right-click a token → Crawl Keeper → Add effect…. Then with the panel open on Settings, right-click two tokens → Add effect to 2…. Then a prop | The panel opens on the list with the Add effects sheet for that token (its name at the top); from Settings it comes back to the list with both names; a prop works too. The menu has 7 rows, none cut off | 2026-11-05 |
| 88 | GM: on one token add Focus (Hold Person), DIS, and Bless (custom); on another add four kinds (ADV, Stuck, Blinded, a custom). Move, resize and rotate the tokens | First token: ◎, DIS, ✱ in a row on its bottom edge; second: ADV, Stuck (in order), then +. They follow the token, stay small, and don't cover the ring, skull or light badge | 2026-11-06 |
| 89 | GM: a hidden effect on a token, and hide a token holding effects. Player (private window) looks at the map | GM sees the hidden effect's icon faded, after the others; the player sees neither it nor any icon on the hidden token, and no gap | 2026-11-06 |
| 90 | GM: a Bless with 1 round; ▶ past its end. Remove an effect from its line. Settings → Show effect icons on the map off, then on | The icon goes when the effect ends or is removed; off clears every icon, on brings them back | 2026-11-06 |
| 91 | GM: Aria with three effects, Borin with two, Tamsin with one; ▶ through the turns. Click a folded line, then its header. Player (private window) looks too | Effects sit under each row, lined up with the name. Tamsin's one shows as its line. Others fold to "N effects", their icons and "next ends N rnd"; the row with the turn opens and folds again when the turn moves; a click opens or folds one. Player: same, nothing hidden, no clicks | 2026-11-06 |
| 92 | GM: right-click a token → Add effect…. Name Bless, Rounds 3; click ADV and Stuck; set ADV to Roll 1d4, Stuck to Ongoing and hidden; click Blinded twice. Add 3 effects. Then Undo | The sheet covers the list (header stays). Blinded comes and goes. All three land on the token as one undo step ("Add 3 effects"); Undo takes all three away | 2026-11-06 |
| 93 | GM: Add effect… with two rows selected; a Focus and a blank second effect. Then Gob: Paralyzed "While Aria's Hold Person lasts". Esc, ✕ and Cancel each close it | Only one effect can be Focus; Add with a blank one adds nothing and says "Effect 2: An effect needs a name". Paralyzed goes when Hold Person ends | 2026-11-06 |
| 94 | GM: a crawl with a check due, a focus check, an effect ending now, a burned-out torch and a free-standing effect. Then ▶, and the same in combat | Title, then the turn bar, then the slim crawl card, then one notices card. ◀ ▶ stays put as notices come and go. Darkness and the focus check always show; the rest fold to "N more · …" with an amber count and open on click; one alone shows as itself | 2026-11-06 |
| 95 | GM: ⏳ beside the title. Click 30m, then type 1:30, then "nonsense". Pass 30m; Undo. Esc and ✕ close it; Add effect… while it's open | The sheet covers the list and previews each torch's time before → after, rounds effects that end, focus and ongoing that stay. Bad input says "Try 10m…". Passing changes lights and effects in one undo step, with the "time passed" notice. Add effect… replaces it | 2026-11-06 |
| 96 | GM: Add effects sheet: the rounds fields and a hidden toggle, light and dark theme | No tiny ▲▼ arrows on the rounds fields. The hidden toggle is a green open eye (players see it) or a red struck eye (hidden) | 2026-11-06 |
| 97 | GM and a player (private window): a torch burns out, Time passes 10m, ▶ ends a Bless, switch to Combat, GM clicks Lost on a focus check. Then GM: Settings → Session log; player: the scroll beside the flame | Each event is in the log once, newest first, with the time; the player's log has what the player was told (no focus lost, nothing hidden). Back from the GM's log goes to Settings. Reload the room: the log is still there | 2026-11-06 |
| 98 | GM: two burned-out torches in the notices. ✕ one; ▶ | ✕ takes that one away; ▶ takes the other. Neither comes back on reopening the panel; the log still has them | 2026-11-06 |
| 99 | GM: Session log → Download, then Clear (confirm) | A text file, oldest first, with dates and times. Clear empties the log in this browser only (the player's stays) | 2026-11-06 |
| 100 | GM and a player: remove an effect from its line, Lost on a focus that has an effect ending with it, Time passes over a Bless, delete a token holding an effect. Check both logs | Each shows "… removed." with no Owlbear notice; an effect that had already ended isn't logged twice; the player's log skips hidden effects | 2026-11-06 |
| 101 | GM: tokens, monsters, effects, lights (one on a campfire prop not in initiative), round 5 in combat, a few log entries. Settings → Reset all…: read the warning, Cancel; again, Download the log, Reset all. Then Undo | One red warning lists what goes and says the log can't be undone; Download saves it. After: only the GM row, round 0, Crawl, clock full, danger back to Unsafe; no effects or map icons; the tracked tokens' lights gone, the campfire still lit; rings and skulls gone; the log has only "Reset all" (and the removed effects). Undo puts the tracker, effects and lights back, not the log | 2026-11-06 |
| 102 | GM: type rolls on three rows out of order; Roll d20+N on the GM row; clear one roll; drag a row, then type a roll | Each roll entered re-sorts the list highest first at once (monsters stay under the GM row); clearing a roll doesn't move anything; a drag holds until the next roll. Reset all is the last thing on the Settings page | 2026-11-06 |
| 103 | GM: Settings → What players see: switch the clock, the danger level and the rolls on and off, in clock and standard mode; compare with the player's window | A small green eye sits on the dial (clock), beside the danger level, and on the die (rolls) exactly when the player sees that thing; hover says what. Light and dark theme | 2026-11-06 |
