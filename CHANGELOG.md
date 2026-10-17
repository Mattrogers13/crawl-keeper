# Changelog

Versions follow semver; the same number is in `package.json` and `public/manifest.json`.

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
