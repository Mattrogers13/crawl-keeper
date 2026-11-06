# Changelog

Versions follow semver; the same number is in `package.json` and `public/manifest.json`.

## v0.4.0 (2026-11-06)

- Effects: focus, conditions and timed effects (`docs/effects.md`). Add them from a row's menu, from a token on the map (right-click → Crawl Keeper → Add effect…, which opens the panel on it), or with Add effect under the turn bar for one on no token; with rows selected, each gets each. The Add effects sheet covers the list and takes several at once, each with its own duration (Rounds, a Roll such as 1d4, Focus, Ongoing, or while a caster's focus lasts), the turn it counts down on, and a hide-from-players eye (green: players see it; red: hidden). One undo step for the lot; nothing is added if one is wrong, and the error says which.
- Focus (p. 50): on the caster's turn a reminder asks for the focus check; Lost ends the focus and what lasts with it, Nat 1 also gives the critical-failure reminder (p. 45). Row menu → Focus check now asks off-turn. Mark dead ends a focus; Reset rounds keeps each effect's rounds left; Time passes ends rounds effects (p. 82). Up to 24 effects on a map.
- Effects sit under their row, like the monsters under the GM row: one line each with its icon and time left; two or more fold to one line (their icons and the next to end) and open on that row's turn. Click one to set its rounds left or remove it. Players see them read-only, minus hidden ones and those on tokens hidden from them.
- Effect icons on the map: up to three small icons along a token's bottom edge (focus, the condition, ✱ for custom, + for more); faded for the GM when hidden, never shown to players then. Settings → Show effect icons on the map.
- Everyone gets a notice when an effect runs out ("Bless on Aria ended."), once.
- The top of the panel, reorganized: the turn bar (Crawl / Combat, sort, ◀ ▶) sits right under the title, so it no longer moves when a notice appears; a slimmer crawl card; and one notices card under it: total darkness and focus checks always show, the rest (effects ending, lights burned out, effects on no token) fold to one line with a count. A burned-out light leaves once dismissed (✕) or when the turn moves on. The light strip is gone.
- Time passes is the hourglass beside the title: 10m, 30m, 1h, an 8 hour rest (p. 86) or any time, with a preview of what it will do (each light before and after, the effects that end, what stays). The Light Tracker keeps its own field.
- Session log (Settings → Session log; players: the scroll beside their flame): every notice kept with its time (lights burning out, Time passes, effects ending or removed, combat, a focus lost), per browser and per room, up to 500; Download as text, Clear.
- Settings → Reset all (last on the page): one warning, then a new session: this map's tracker back to the GM row (rounds, phase, clock, rolls, danger level reset), its effects and the lights on its tokens removed, and the session log cleared (download it first). Undo brings back all but the log.
- Entering a roll sorts the tracker by roll at once (the GM row's Roll d20+N too); clearing one leaves the order alone.
- A small green eye on the GM's crawl card marks what players can see: the Crawling Clock, the danger level, the rolls.
- Settings no longer shows the install link (the how-to guide has it) or the Dev-only scene size test.
- Dev builds keep the manifest version within Owlbear's 16 characters.

## v0.3.0 (2026-11-01)

- Light Tracker (GM): every light's timer, the party's light, Time passes (10m, 1h, 1:30), Put lights out, Pause, Ride along or Separate timers; click a time to correct it; Remove all lights. A torch, Light spell or campfire is used once lit: putting it out spends it. A lantern put out keeps its oil to the quarter hour (45, 30, 15 minutes, then empty), lights again and takes oil. Lights start on tokens: a row's menu → Give torch, lantern or Light spell (one lit light per token). Every change can be undone.
- A light strip under the title (GM, once there are lights): Time passes, red with "No light · total darkness", and which light burned out. One light badge per row (click: put out, light the lantern again, or a new torch; players see them). The flame beside the gear opens the Light Tracker (dim with no lights). DIS on living players' rows in total darkness.
- Darkness, the toolkit's way (replaces Follow Torchlight): Settings → Follow light (on). With lights tracked and none shining, it's total darkness: a red notice on the crawl card, a check every crawl round in Interval or Manual, a d8 crawling die on the clocks (the roll button turns into a d8), DIS on the party's rows. The danger level is no longer changed. With no lights tracked, or Follow light off, the crawl card's Torchlit / Darkness switch decides, now in every mode, per map; the Light Tracker then says no light is shining, not total darkness.
- Lights on the map (needs Dynamic Fog): a token holding a lit light casts it, near 30 ft (a lantern 60 ft), and gets its own light back when it goes out; a torch, lantern or Light spell also shows its icon on the token. A campfire is a stationary light: no icon and no initiative row. Right-click a token → Crawl Keeper: Add / Remove initiative, Light torch, Light lantern, Cast Light, Light campfire (any token, props too) and Put out, for one token or several; every one can be undone. A token doesn't have to be in initiative to carry a light.
- Players light their own (Settings → Players' lights → Players light their own, off by default): players right-click a party token (a player on the initiative list, or a token they placed) → Crawl Keeper: Light torch, Light lantern, Cast Light, Put out. Players get the flame in their header too: their Light Tracker shows whether the party has light, every light (read-only), and a "Your light" card with their lights (tokens they placed or lit) with Put out, Light lantern again and + Torch, + Lantern, + Light spell; lighting a second one there asks first. It works while the GM is in the room: the GM's Crawl Keeper checks the setting and the token, then saves it. Players see the light the GM gave them either way. Show lights to players (on): players see the party's light and every light in their Light Tracker, the row badges and DIS; off, only their own card. Up to 16 lights in a room (was 12). Undo puts back only the lights that step changed, so it never takes back a light a player lit since.
- Notices for everyone when a light burns out or is put out, and when the GM says time passes.
- The party's minimum light: 3 ft of dim light on every party token without a light of its own, always (it used to come only in total darkness), so players see their own tokens through Dynamic Fog.
- Double-click a row to center the map on its token (the zoom stays); one click still selects the row.
- Crawl Keeper no longer reads Torchlight: its flame beside a row's name is gone (the light badge replaces it), and tokens Torchlight lit are no longer skipped. The homepage guide gains Lights and darkness, and its darkness rules are brought up to date.
- Look, matched to the mockups: names sit level with the portrait and badges (an empty note no longer pushes them up; Add a note still shows on hover), a softer red Put lights out, tighter Light Tracker timers with warmer bars, and Settings' "Darkness by hand" line padded like the rest.

## v0.2.0 (2026-10-31)

- Undo and Redo for every GM action (turns, rolls, edits, row menu, right-click Add / Remove, settings), up to 50 steps, under the list on every screen; Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z. Bigger actions (Remove monsters, Remove from initiative, Reset rounds, Reset clock) offer Undo in a toast. Kept while the panel is closed, gone on reload. Replaces the roll-only Undo.
- Follow Torchlight (setting, on): a flame beside tokens with a lit Torchlight light; when the last one goes out, total darkness (Deadly, d8 crawling die) and a 3 ft light on the party's tokens; the first light back undoes it.
- Manual rolls (Settings → Encounters → Manual): no clock and no auto roll. The card keeps the danger level, lights up on the GM's turn when a check is due, and its d6 rolls a check; or roll at the table: ▶ off that turn counts a due check made.
- A 2d20 Crawling Clock (Settings → Encounters → Clock 2d20): 40, run down one d20 at a time; the omen and encounter on the last die, the overflow carries into a fresh 40.
- Settings laid out like the web toolkit: one choice of Interval, Clock 1d20, Clock 2d20 or Manual, and a Darkness card for Follow Torchlight.
- Players: the card says "Crawling Clock" when it shows the clock; in Manual mode they never see the GM's encounter roll.
- A failed check for an open map retries, instead of leaving the panel waiting until it's reopened.

## v0.1.1 (2026-10-17)

Polish from the first full room pass (2026-10-17).

**Panel**
- The round count is a pill beside the title that also says Crawl or Combat (red in combat).
- The crawl card in three parts: a dial with a sapphire d20 (rounds to the next check, or the Crawling Clock), the danger level as a dropdown (Crawling Clock: a Torchlit / Darkness toggle for the d8), and a d6 that is both the "Encounter check" button and its last result. In combat it folds to one line.
- Standard checks drop the darkness switch: total darkness makes a place Deadly (p. 84), so pick Deadly.
- Reset rounds and Remove monsters moved up under the turn bar.
- Rows as a table: checkboxes for selecting, a quiet tint for the selection, borderless inputs, monospace rolls.
- The GM / Monsters row: a d20 left of its roll opens the monsters' DEX and Roll; the roll shows its equation (`d20 12 + 2`). A hooded portrait for the row.
- Monsters fold under the GM row (remembered per browser); a monster's combat turn shows them.
- Players: a small card with the clock, danger level and last roll (each when the GM shows it; new "Show the rolls to players" setting) and a "Your turn" strip on their own token's turn.

**Map**
- A skull badge over dead tokens (matches the token's visibility; off when revived or removed).

**Security**
- Markers and skulls are only removed or re-shown when they're really ours, not just tagged; CSP and nosniff headers; read-only CI token.

## v0.1.0 (2026-10-16)

First release. A Shadowdark crawl companion for Owlbear Rodeo: the GM runs it, players get a read-only view.

**Initiative tracker**
- Add or remove tokens with one right-click item on the map; a built-in GM / Monsters row.
- Rolls edited in place, Sort (highest first), drag to reorder (mouse, touch or keyboard), notes under each name.
- Monsters grouped under the GM / Monsters row, acting on its roll: a DEX box and a d20 button roll d20 + the monsters' highest DEX modifier (core pp. 83, 88). In combat each living monster takes its own turn.
- Row menu (right-click or ⋯) and batch selection: mark monster or player, dead or alive, turn marker on or off, show on map, remove.
- Tokens deleted from the map drop out; hidden tokens stay out of the players' list.

**Turns and rounds**
- ▶ / ◀ with one round count through Crawl and Combat; the GM's hotkeys N, B and R while the panel has focus.
- A gold turn-marker ring on the current token (follows it, matches its visibility) and the token selected on the GM's screen; both optional.

**Crawling**
- Standard encounter checks (core p. 112): a d6 every 3 / 2 / 1 crawl rounds by danger level, every round in total darkness (p. 84); an encounter on a 1.
- The Crawling Clock: a d20 dial from 20 worn down by the crawling die (exploding; a d8 in darkness), an omen at 5 or lower, an encounter at 0 with the overflow carried over. Fights don't reset it; Reset clock does, for a new dangerous place.
- The roll button is always there for extra checks (which don't move the schedule), highlighted when a roll is due; optional automatic roll on the GM's turn; one-level undo.

**Combat**
- A "Roll for combat initiative" alert for everyone; rolls cleared for a fresh roll (optional); Remove monsters after the fight.

**Look and settings**
- Owlbear-native panel that follows Owlbear's light and dark themes; the Keeper's key icon.
- Settings in cards with switches: encounter method (with the Crawling Clock rules), what players see (rounds, clock, danger level), turns and combat, saved data size, install link.
- A how-to guide at the extension's own URL, linked from Settings.
