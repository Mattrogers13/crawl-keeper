# Crawl Keeper UI review (v0.6.0, 2026-11-07)

An independent review by a fresh agent with none of the build history. It read the code, docs/design.md, CHANGELOG.md and TESTING.md, rendered 21 real `App` states with the repo's OBR mock, and screenshotted them with headless Chrome at Owlbear's default popover size, 400 x 600 CSS px (from `public/manifest.json`), at 2x. Nothing in the app was changed.

- Screenshots: `shots/` (GM: `gm-*.png`; players: `player-*.png`; the right-click menu: `map-menu.png`).
- How they were made: `method/` (the throwaway render tests, renamed `.txt` so vitest ignores them, and `shoot.sh`).
- Checked against the code before this was filed: the round-number cut-off (`shots/gm-crawl-dark.png`, `Panel.tsx`), the stale "Add / Remove Initiative" text, the stale Manual hint, and the 400 x 600 default size all hold up.

Three things in the screenshots come from the method, not the app:
- The serialized HTML doesn't keep a dropdown's chosen value, so the danger level always reads "Unsafe" and "counts down on" shows its first option.
- In `gm-rowmenu.png` the menu sits where jsdom placed it, so it runs off the 600 px frame. `gm-rowmenu2.png` is placed correctly.
- The mock's light theme reuses the dark theme's accent color.

## 1. Top 5 changes, ranked by payoff

### 1. Give the initiative list its space back

At the default 400 x 600 popover, the list gets about 160 to 210 px, roughly a third of the panel. That is 2.5 visible rows with four players, three monsters and a few effects (`gm-crawl-dark.png`, `gm-undobar-notices.png`).

Measured heights (CSS px):

| Part | Height |
|---|---|
| Header | 57 |
| Turn bar | 48 |
| Links row (Reset rounds · Add effect · Remove monsters) | 30 |
| Crawl card | 96 (clock mode: 115) |
| Notices | 37+ |
| Column header | 22 |
| Hotkey line | 20 |
| Undo bar | 40 |
| Version footer | 20 |

Patterns: progressive disclosure, which says to show only frequent options first and move the rest one step away (https://www.nngroup.com/articles/progressive-disclosure/). Heuristic 8: "Interfaces should not contain information that is irrelevant or rarely needed" (https://www.nngroup.com/articles/ten-usability-heuristics/).

Changes:
- **One bottom row instead of three.** The hotkey hint goes into the ◀ ▶ tooltips, which already say "(N)" and "(B)", and into the empty state. The version moves to Settings → About; Dev builds keep their DEV label in the footer. Undo and Redo share one row.
- **Remove the links row.** Reset rounds goes in a menu on the round pill. Remove monsters goes on the "Monsters · 3" header. Free-standing Add effect goes in the notices card or a + beside ⏳.
- **Drop the "Combat · encounter checks paused" card** (see 5).

This frees about 110 px, two to three more rows. Nothing is lost. Effort: M.

### 2. The round number is cut off: drop the title text on the tracker view

In every GM screenshot with lights tracked, the round pill reads "Crawl · Round" or "Combat · Roun" with no number. The cause is `Panel.tsx:54`, where the slot is `min-w-0 truncate`: the key icon, the 17 px "Crawl Keeper" title and four header icons (⏳, ❚❚, flame, gear) use up the 400 px.

Pattern: heuristic 1, visibility of system status (same NN/g URL).

Change: on the tracker view, show the key icon only and drop the title text. Owlbear's toolbar button already names the extension. Keep the title on the Settings, Light Tracker and Log views. Effort: S.

### 3. Sheets get the whole panel below the header, with actions always visible; one death prompt, not two

Time passes, Add effects, Dying and the death prompt cover only the list area (`Tracker.tsx:747-775`), about 250 px at 600. As a result:
- "Pass 1h" is below the fold (`gm-timepasses.png`).
- Add effects fits one effect before scrolling (`gm-addeffect.png`).
- The death prompt repeats the dying line and its six buttons that the notices card already shows directly above it (`gm-combat-deathprompt.png`).

Pattern: NN/g says partial sheets "aren't suited for displaying always needed information or tools" and expanded sheets become modal (https://www.nngroup.com/articles/bottom-sheet/). The app already uses a modal for "Who carries the light?" (`Tracker.tsx:970`).

Change: render these sheets over everything below the header, like the Light Tracker and Settings views, with the Cancel and primary buttons in a footer that stays put. Hide the notices dying line while the prompt is open, or make the prompt a modal. Everything is kept. Effort: M.

### 4. Use Undo instead of confirms where Undo already covers it

Reset rounds, Remove monsters, Reset clock and Remove all lights each ask first (`Tracker.tsx:615-633`, `CrawlBar.tsx:172-179`, `LightTracker.tsx:93-100`). They are also undo steps with an 8 s Undo toast, so the GM pays twice.

Patterns: "Never use a warning when you mean undo" (Raskin, https://alistapart.com/article/neveruseawarning/). NN/g: "if you warn people too much, they stop paying attention" and "do go to great lengths to provide undo" (https://www.nngroup.com/articles/confirmation-dialog/).

The confirms date from 2026-10-16, for stray clicks. Global undo arrived on 2026-10-30, after that decision. Change 1 also moves these buttons away from where stray clicks happened.

Change: run them at once and offer Undo in the toast. Keep the confirm only for Reset all (the log can't come back) and Clear log. Effort: S.

### 5. One place and one color for each state

Several states are shown three times:
- **Combat:** the red header pill, the red Combat button, and a red "Combat · encounter checks paused" card.
- **Darkness:** the crawl card chip, a red "Darkness · DIS" line in the notices, and DIS on every party row.
- **Lights paused:** a full-width red "Paused" bar, an amber ▶ in the header, and the Light Tracker's own Pause.

Red also means encounter, dead, dying, low light, Put lights out and Reset all.

Patterns: Apple HIG, use each color for one meaning and not color alone (https://developer.apple.com/design/human-interface-guidelines/color). NN/g indicators "can introduce noise and clutter" (https://www.nngroup.com/articles/indicators-validations-notifications/). Material: a banner is fine for a persistent state ("Banners must remain on screen until dismissed", https://material.io/components/banners).

Changes:
- Drop the combat card; the pill and button already say it.
- Merge the darkness line into the crawl card chip, made red and reading "Darkness · DIS".
- Make the Paused bar slim and amber ("Lights paused · Resume").

No information is lost. Effort: S.

## 2. Full findings by area

### 2.1 Panel shell and header

- **H1. Round pill truncation.** See 2. Effort: S.
- **H2. Pause appears three times.** The header ❚❚ (`Panel.tsx:152-170`), the red bar's click-to-resume (`:132-147`) and the Light Tracker's Pause (`LightTracker.tsx:64-70`). It crowds the header that causes H1. Pattern: heuristic 8. Change: one main-page control, either ❚❚ or a slim banner (owner's choice, Q1). Keeps pause and resume on the main page. Effort: S.
- **H3. Version footer and hotkey line take two permanent rows** (`Panel.tsx:246-251`, `Tracker.tsx:873-879`). Pattern: heuristic 7, shortcuts "hidden from novice users". Change: see 1. Keeps everything, moved. Effort: S.
- **H4. Undo bar is a full row of two pills, and Redo is usually disabled** (`UndoBar.tsx:61-72`). Change: one compact row, `[↶ Undo: Next turn]` plus an icon-only Redo whose tooltip names the step. Keeps the named steps. Effort: S.
- **H5. Gaps add up.** `gap-3`, the header hairline and `pb-3` (`Panel.tsx:37-39`). Change: `gap-2`, and drop the hairline on the tracker view. Effort: S.

### 2.2 Tracker list and rows

- **T1. About 60 px of invisible left gutter on every GM row at rest.**
  - Saw: the hover-only grip and checkbox reserve columns (`TrackerRow.tsx:142-168`; `pl-[82px]` at `Tracker.tsx:795`). Names truncate early ("Holding…" in `gm-combat-focus-party.png`).
  - Patterns: heuristic 8; hidden controls hurt discovery (WCAG Visible Controls, https://w3c.github.io/wcag/understanding/visible-controls; NN/g, https://www.nngroup.com/articles/hamburger-menus/). The current state is the worst of both: the space is spent and the controls are still hidden.
  - Change: hide the checkbox column on hover-capable pointers, where Cmd and Shift-click already select. Keep it on touch, where it's the only way to multi-select. Let the grip overlay the row edge on hover.
  - Keeps: drag, keyboard drag, touch multi-select. Effort: M.
- **T2. Light badge, PARTY and DIS share the name line with the 72 px Init column** (`TrackerRow.tsx:226-236`). Names and notes get cut.
  - Pattern: Foundry rows are thumbnail, name and initiative, with the rest in the context menu (https://foundryvtt.com/article/combat/).
  - Change: move the badges to the line under the name, with the note and folded effects.
  - Keeps: everything; a badge click still opens the Light Tracker. Effort: S.
- **T3. ⋯ is hover-only on desktop** (`HOVER_ONLY`, `TrackerRow.tsx:517`), yet it's the only visible way into the row menu.
  - Pattern: WCAG Visible Controls (above).
  - Change: show ⋯ at about 35% opacity at rest. Its column is already reserved, so no width cost. Effort: S.
- **T4. The row menu has 11 items in 5 groups** (Aria: Mark as monster, Mark dead, Dying…, Show on map, Rename…, Set as party token, Turn marker off, Add effect…, two "Put out the torch, light the …" swaps, Remove). That's about 440 px of a 600 px panel, with set-up items above the ones used in a fight (`RowMenu.tsx:69-114`, `gm-rowmenu2.png`).
  - Pattern: NN/g, "fewer than 10–12 items", most-used at the top (https://www.nngroup.com/articles/contextual-menus/).
  - Change: put Add effect, lights and Dead/Dying first, then set-up items, then Remove. Fold the two swaps into one "Light…" item, or label them "Swap to lantern" and "Swap to Light spell".
  - Keeps: every item. Effort: S.
- **T5. Stale copy: "Add / Remove Initiative" doesn't exist.** `Tracker.tsx:867` and `Homepage.tsx:31` name it, but since v0.3 the path is right-click → Crawl Keeper → Add to initiative (`mapMenu.ts:77`, `map-menu.png`). Pattern: heuristic 4, consistency. Change: fix both strings. Effort: S.
- **T6. Sort is a 10 px dotted-underline "Init" header.** Pattern: WCAG 2.5.8, at least 24 x 24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Change: a 24 px hit area until the planned delete-or-keep decision. Effort: S.
- **T7. Mixed type faces.** Small monospace captions ("d20 12 + 2", "next ends 2 rnd", "3 rnd", "ongoing") sit beside the UI font at 11 px, which reads as noise. Change: use the UI font with `tabular-nums`; keep mono for the big Init numbers. Effort: S.

### 2.3 Turn bar and crawl card

- **C1. Links row.** See 1. Pattern: progressive disclosure; Foundry keeps resets in the header or menus. Effort: S.
- **C2. The crawl card is 96 to 115 px when no roll is due**, which is most rounds. Pattern: NN/g says indicators should earn their space. Change: two lines, about 64 px. Line one: a 40 px dial, the danger level, the cadence, the darkness chip. Line two: the die and outcome. Reset clock goes on the dial's right-click menu (it's already there, `CrawlBar.tsx:113`) and the danger/clock menu. Keeps everything, including the eyes and the due highlight. Effort: M.
- **C3. The darkness toggle's text flips between "Torchlit" and "Darkness"** while it is `aria-label="Darkness"` with `aria-pressed` (`CrawlBar.tsx:267-287`).
  - Pattern: WAI-ARIA guidance: "it is critical the label on a toggle does not change when its state changes" (https://www.w3.org/WAI/ARIA/apg/patterns/button/).
  - Change: a Torchlit | Darkness segmented control like Crawl | Combat. Keeps the lock while following lights. Effort: S.
- **C4. The rolls eye is a 16 px button sitting on the die** (`CrawlBar.tsx:209-225`). In Manual mode the tiny d8 also sticks out above the card and its "ROLL" label sits under the eye (`gm-crawl-manual-dark.png`).
  - Patterns: WCAG 2.5.8; Fitts's law (https://www.nngroup.com/articles/fitts-law/).
  - Change: put a 24 px eye beside the die, and fix the overflow. Effort: S.
- **C5. The Manual hint in Settings describes the old card.** `Settings.tsx:55-56` says "The card shows the danger level and lights up on your turn when a check is due". In v0.6 the Manual card has no danger level and no due highlight (`CrawlBar.tsx:67-99`). Pattern: heuristic 4. Change: fix the copy, and decide Q5. Effort: S.
- **C6. Combat card** (`Tracker.tsx:705-709`). See 5. "Encounter checks paused" moves to the Combat button's tooltip.
- **C7. ◀ ▶ placement and size.** Keep.

### 2.4 Notices

- **N1. "Darkness · DIS" line** (`Notices.tsx:167-174`) repeats the chip. See 5.
- **N2. The burned-out light ✕ is 20 px** (`Notices.tsx:124`). Change: 24 px (WCAG 2.5.8).
- **N3. The dying line wraps six buttons onto two lines** (`gm-combat-dying.png`). Stabilized and Healed are also on the Dying effect's own menu (`Effects.tsx:121-140`), and Dead is the row menu's Mark dead.
  - Pattern: NN/g contextual menus, short with most-used first.
  - Change: show the turn's decision (Roll d20 · Nat 20 · Not a 20) plus "More" for Stabilized, Healed and Dead. Owner's call (Q6). Effort: S.
- **N4. The "3 more · …" fold with an amber count works.** Keep.

### 2.5 Lights

- **L1. The Light Tracker opens on controls, not lights.**
  - Saw: banner, Pause, (i), the Time passes field, then a full-width red "Put lights out" before the first light. Cards are about 110 px each, so three fill the view (`LightTracker.tsx:62-87`, `gm-lighttracker.png`).
  - Patterns: progressive disclosure; heuristic 8.
  - Change: compact rows of about 52 px (icon, name, time, bar). Put out, Refill, Edit and Remove move behind ⋯ or appear on the selected row. "Put lights out" becomes a quiet button beside "Remove all lights".
  - Keeps every action. Effort: M.
- **L2. Two different Time passes UIs.** The ⏳ sheet has quick picks and a preview; the Light Tracker has a bare field (`LightTracker.tsx:175-211`). Pattern: heuristic 4. Change: the Light Tracker opens the same sheet. Design.md records the separate field as deliberate (Q4). Effort: S.
- **L3. A once-per-campaign rule sits in the timer view.** "Second light: Ride along / Separate timers" is at `LightTracker.tsx:103-115`, while light settings are spread over three Settings groups. Change: one Settings → Lights group with Follow light, Second light, Players light their own and the darkness-by-hand pointer. "Show lights to players" stays in What players see. Effort: S.
- **L4. "Campfire · Campfire".** When the token is named after its light, the card says it twice. Change: show the token name only when it differs. Effort: S.
- **L5. The row badge opening the Light Tracker** is right. Keep (placement per T2).

### 2.6 Effects

- **E1. The Add effects sheet is cramped.** See 3.
- **E2. Free-standing Add effect sits in the links row.** See C1.
- **E3. Keep:** effects folded under rows that open on that row's turn, the amber last round, the dashed outline with a struck eye for hidden effects, and the condition pills.

### 2.7 Settings

- **S1. Settings is about 2,000 px long at 400 px wide** (`gm-settings.png`).
  - Saw: nine groups, and hints of two to five lines ("Players light their own" runs five lines, `Settings.tsx:163-168`). The How-to and Session log cards push the first setting down about 150 px.
  - Pattern: NN/g, "lengthy content is no longer a 'tip', so keep it brief" (https://www.nngroup.com/articles/tooltip-guidelines/). The app's own (i) popup (`InfoPopup.tsx`) already does this for the light rules.
  - Change:
    - Cut hints to one line and put the detail behind an (i) per group.
    - Order the groups by how often they change mid-session: What players see, Encounters, Lights, Turns and combat, Dice.
    - Make How-to and Session log slim rows near the end.
  - Keeps every switch and all the text, which moves into the (i) popups. Effort: M.
- **S2. Stale Manual hint.** See C5.
- **S3. "Saved data" is a diagnostic.** Change: collapse it in `<details>` under About. Effort: S.
- **S4. Keep Reset all's single specific warning,** with Download first.

### 2.8 Menus

- **M1. Map menu: hidden reasons on touch.** Disabled rows with a reason follow NN/g's advice to disable rather than hide (https://www.nngroup.com/articles/contextual-menus/). But the reason is only in a `title` tooltip, which never shows on touch (https://www.nngroup.com/articles/tooltip-guidelines/). Change: put the reason in the label, for example "Hand light to… (select two)", so the fixed nine-row height doesn't change. Effort: S.
- **M2. Row menu.** See T4.

### 2.9 Player view

- **P1. Keep the calm player view:** "Your turn, <name>" strip, read-only rows, no controls.
- **P2. No turn signal for players with the panel closed** (a design.md candidate).
  - Pattern: heuristic 1. The SDK supports it: `OBR.action.setBadgeText` and `setBadgeBackgroundColor` in `sources/sdk/src/api/ActionApi.ts:40-51`.
  - Change: the player's background page shows a toolbar badge while their token has the turn. It's an addition and costs no panel space. Effort: S to M.
- **P3. Repeated footnote.** "One lit light per token…" (`YourLight.tsx:131-133`) repeats what the confirm already says. Change: drop it. Effort: S.

### 2.10 Homepage

- **W1. A long text-only page** with about ten sections, no contents list, GM and player instructions mixed, and the stale menu path from T5.
  - Pattern: heuristic 10, help that is task-focused and easy to scan.
  - Change: a contents list at the top with GM and Player anchors, one annotated GM-panel screenshot (the CLAUDE.md render workflow can make it), and the menu path fixed. Effort: M.

### 2.11 Map visuals

- **V1. Checked from code and the passed room tests only; the map can't be screenshotted without Owlbear.** The ring is 1.5x the token's footprint and matches its visibility. Skull, badge and effect-icon placements don't collide (TESTING row 88). Open question: on 1-cell tokens, should effect icons fold to "+" after two instead of three (Q8)?

### 2.12 Accessibility

- **A1. Contrast.**
  - `text-obr-text-disabled` is used for NAME / INIT (10 px uppercase) and placeholders. It measures 3.34:1 on dark (#777 on #222639) and 2.85:1 on light, below 4.5:1 (WCAG 1.4.3).
  - "check now" in the accent color is about 2.3:1 on the mock's light theme. Owlbear's real light-theme accent is still unverified (design.md candidate).
  - Change: use secondary text (about 7.5:1) for the column header, and don't rely on accent-colored text for "check now". Effort: S.
- **A2. Targets under 24 px:** the rolls eye (16), notice ✕ (20), checkbox (14), grip (16 x 32) and the Init link. Change: pad the hit areas without changing the look. Effort: S.
- **A3. Changing toggle label.** See C3.
- **A4. Keep:** live regions on rolls, `aria-current="step"`, keyboard drag, and real radios and checkboxes under the segmented controls and switches.

## 3. Works well; don't change

- **Turn bar:** Crawl | Combat plus a big ◀ ▶ that never moves. Owlbear's own tracker also puts its arrow at the top of the popover (https://extensions.owlbear.rodeo/initiative-tracker).
- **Typing a roll sorts the list,** as D&D Beyond's Encounters does (https://www.dndbeyond.com/posts/1135-free-for-all-users-build-d-d-encounters-and-track).
- **Right-click or ⋯ row menu with batch selection,** as Foundry does (https://foundryvtt.com/article/combat/).
- **Global undo with named steps and the toast.** It's what makes change 4 safe.
- **Monster and effect folds that open on the relevant turn,** and the notices fold.
- **One light badge per row,** with full detail in the Light Tracker.
- **The map menu's fixed rows,** disabled with reasons.
- **The hidden-effect look,** and the green "players see this" eyes.
- **Reset all's warning,** with the log download.
- **The player view's restraint.**
- **Owlbear-native theming** through the `--obr-*` variables.

## 4. Open questions for the owner

1. Main-page Pause: keep the header ❚❚ and drop the banner, or keep a slim amber banner and drop ❚❚?
2. Drop the confirms on Reset rounds, Remove monsters, Reset clock and Remove all lights now that Undo covers them? (This reverses a 2026-10-16 decision.)
3. Undo bar: Undo named and Redo as an icon, or both named?
4. Time passes: one shared sheet, or keep the Light Tracker's own field?
5. Manual mode: should the card light up when a check is due, as the hint promised, or only the copy changes?
6. Dying line: six flat buttons, or the turn's three plus "More"?
7. On a mouse, do you multi-select with the checkboxes or with Cmd/Shift-click? The answer decides whether the desktop checkbox column goes.
8. Effect icons on 1-cell tokens: fold to "+" sooner?
9. Default popover height: stay designed for 600 px, or raise the manifest default to 700 or 800? Several findings shrink with more room.

## Other sources consulted

- Owlbear extension store: https://extensions.owlbear.rodeo/pretty-sordid
- Roll20 Turn Tracker: https://help.roll20.net/hc/articles/360039178634
- On confirms versus undo: https://uxplanet.org/confirmation-dialogs-how-to-design-dialogues-without-irritation-7b4cf2599956 and https://dev.to/137foundry/how-to-choose-between-confirmation-dialogs-undo-windows-and-soft-delete-patterns-1opj
- Foundry Combat Tracker Extensions module: https://foundryvtt.com/packages/combat-tracker-extensions
