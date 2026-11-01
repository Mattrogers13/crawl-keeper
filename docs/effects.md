# Effects: focus, conditions and timed effects (plan, 2026-11-01)

Matt's ask (2026-11-01): a focus marker on a token with a built-in focus check reminder; ADV and DIS icons and any other conditions Shadowdark uses; a tracker for spells and other effects with a duration, on a token or on its own, so everyone sees what's still running and what ends soon. Built as **one system** (Matt, 2026-11-01): an effect is a tag with an optional holder, an optional duration and an optional map icon. Not built yet; v0.4, before the rollers, Dice+ and End tracker (now v0.5) (Matt, 2026-11-01).

## Rules it follows (Shadowdark core)

- **Focus (p. 50):** one focus spell at a time; end it any time; a spellcasting check at the start of your turn keeps it until the start of your next turn; failure ends it (the spell isn't lost); a natural 1 also counts as a standard critical failure (p. 45: a wizard can't cast that spell again until a rest and rolls on the Wizard Mishap table, p. 46; a priest can't cast it again until they do penance). A natural 20 on a cast doubles one effect until the next focus check (p. 45); not tracked. Taking damage or being distracted calls for a check at once.
- **Conditions (p. 85):** no fixed list: "Some effects impose a condition on a character, such as blindness or immobility. Advantage and disadvantage apply to most situations. Use common sense." Advantage and disadvantage cancel each other (p. 77).
- **Durations:** spells are Instant (32), Focus (23), 5 rounds (13), 10 rounds (11), a day or days (4), Light's "1 hour real time". Other effects in the book: 1d4 rounds (22), 3 rounds (14), 1 hour (12), 1d4 days (5), and a few others.
- **Counting (p. 83, player turn step 1):** "The player counts down any personal timers for spells and other effects." So a timer counts on one creature's turn: the caster's.
- **Time passes (p. 82):** "Minutes Pass. Effects with a duration of rounds expire." "Hours/Days Pass. Effects with a duration shorter than the time passed expire."
- Light spells, torches, lanterns and campfires stay in the Light Tracker, never effects.

## What an effect is

- **Name**, up to 32 characters: a spell, a condition or anything ("Web", "Hold Person", "Bless").
- **Icon** (optional): one of the conditions below. Shown on the row and, if the holder is a token, on the map.
- **Holder** (optional): a token. None: a free-standing effect (Cloudkill, a collapsing ceiling), listed on its own.
- **Duration**, one of:
  - **Rounds:** 1 to 99, typed or rolled when added (1d4, 1d6, 1d8, 1d10, 2d4; one roll for every holder added together, shown in the effect).
  - **Focus:** lasts while the holder focuses (the holder is the caster). Needs a holder.
  - **Until removed:** a condition, or a duration in hours or days written into the name ("Cursed, 1d4 days"). Hours and days don't count down in v1.
- **Counts on:** the row whose turn starts count it down (p. 83), chosen when adding; default the row whose turn it is now (usually the caster). None (between rounds, or the row isn't in initiative): it counts at the top of each round.
- **Ends with** (optional): a focus effect. When that focus ends, so does this (Hold Person's Paralyzed on the goblin ends when the wizard loses focus). A focus effect can't itself end with another, so there are no chains.
- **Hidden** (GM only): not shown to players (the UI only; shared data has no real secrecy, see Roles).

### Conditions with an icon

Focus, ADV, DIS, Blinded, Paralyzed, Invisible, Stuck, Unconscious. Picked by how often the book uses them (paralyzed 23, invisible 23, blinded 13, stuck 12, unconscious 8; dying 15 is the death timer, later). Anything else is a named effect with no icon. A row holding ADV and DIS shows both; their tooltip says they cancel (p. 77), and so do a manual ADV and the darkness DIS.

## Timing, derived on read

Nothing is written when ▶ or ◀ moves the turn. A rounds effect stores where it started (`{ round, at }`: the round and the counts-on row) and its length; how many rounds are left is worked out from the tracker's round and current turn, like `isDark` and lights' `endsAt`. So ◀ brings an effect back, undo needs nothing extra, and the tracker doc is untouched.

- An effect added during round R on row X's turn, for N rounds, ends at the start of X's turn in round R + N.
- Added between rounds (round 0, or after a phase switch): it starts with the next round's top and ends at the top of that round + N.
- Counting row not taking turns: a monster while crawling counts on the GM / Monsters turn; a dead row's turn passes to the next living row (the tracker's `turnFor`); a row no longer in initiative counts at the round's top.
- Dragging rows can move an effect's end by a turn within a round. Accepted: the book times it no finer.
- **Reset rounds** moves every rounds effect's start back with the count, so each keeps the rounds it had left.
- **Time passes** (Light Tracker) ends every rounds effect (p. 82), in the same undo step as the lights. Focus and until-removed effects stay (the book doesn't end them).
- An effect that ended shows "ended" through the turn it ended on, then drops out of view; the next effects write deletes it. Until then ◀ brings it back; after, only Undo does.

## Focus

- Adding Focus to a holder that already focuses asks first ("End Hold Person, focus on Web?"), like a second light.
- **The check:** on the holder's turn (a monster while crawling: the GM / Monsters turn, every focusing monster listed), a reminder under the crawl card: "Kara: focus check, Hold Person (spellcasting check as if casting it)". GM buttons: **Lost** (ends it and what ends with it) and **Nat 1** (the same, plus the critical-failure reminder, p. 45). Kept needs no button: ▶ goes on.
- **Damage or distraction:** the row menu's **Focus check now** shows the same reminder at once, in the GM's panel only (not saved).
- Marking the holder dead ends their focus and what ends with it, in the same step.
- Players see the reminder in their panel, read-only, so the focusing player knows to roll. (A notice on the player's own screen when the panel is closed: later; it needs to know whose token is whose.)

## Where it shows

- **Rows:** chips after the name (icon, name, rounds left; amber at 1 round left; "ended"), the same for players unless hidden. Long lists fold to "+N".
- **Free-standing effects:** a strip under the crawl card, like the light strip. Effects on a token that isn't in initiative show there too, with the token's name.
- **The turn's reminders:** under the crawl card: focus checks, and effects ending on this turn.
- **Map:** a token's icons as small attachments along its bottom edge (up to 3, then a "+" icon), clear of the turn ring, the skull (centered) and the light badge (top right). WebP, our tag, visibility matched to the token, hidden while the effect is hidden. Settings → **Effect icons on the map** (on), for tables that already use a condition marker extension.
- **Notices:** when an effect ends, everyone gets a notice ("Bless on Borin ended"), unless it's hidden. Sent once by the GM's background page; ◀ then ▶ again doesn't repeat it this session.

## Adding and removing (GM)

- **Row menu → Add effect…:** a small form (name with the conditions as quick picks, duration, counts on, ends with, hidden). With rows selected it adds one to each.
- **Right-click a token → Crawl Keeper → Add effect…:** opens the panel on that form. (Opening the panel from the background page is **unverified**: `OBR.action.open`. Fallback: quick toggles for Focus, ADV and DIS only.)
- **Click a chip:** remove, or edit its rounds left.
- Every change is an undo step. Players don't add effects in v1 (later: the request path players use for lights).

## Data and limits

- Scene metadata, its own key `${ID}/effects` (per map, like the tracker; the party's effects stay behind when the GM changes maps). Only the GM writes it. Parsed on every read.
- Removing a token drops its effects (automatic, not an undo step). Undo restores only the effects a step changed, like lights.
- Some GM actions write the tracker and the effects together (Mark dead ends focus; Time passes writes lights and effects). One undo step, recorded after both writes land; if one fails it reverts and says so.
- **Cap:** 24 effects per map, about 150 bytes each worst case (3.6 kB). Measure before building.
- **The scene budget is the risk.** The tracker's worst case is about 12.7 kB; with effects about 16.3 kB. The scene limit isn't documented; 12 kB is verified. **First step:** a Dev-only Settings button writes a 20 kB test key to the open scene, reads it back and deletes it. If scenes share a 16 kB cap, lower the tracker's note cap from 200 to 80 characters (as the lights did) before adding effects.

## Saving and backups

Room and scene data live on Owlbear's servers with the room, not in the browser. Clearing the cache loses only the undo history (gone on reload anyway) and the folded-monsters choice. Real ways to lose data: deleting the map or room, a failed write at the size limit (the panel says so and reverts), or another extension overwriting the room. A **Download backup / Restore** in Settings (the tracker, effects, lights and settings as one JSON file; restore parses it as untrusted and is one undo step) would cover those. It's on the "Later" list as table import/export; it doesn't block effects.

## Edge cases checked

- ◀ past an effect's end brings it back (derived); its notice isn't repeated.
- Holder removed from initiative: its effects stay on the token and move to the strip. The counts-on row removed: the effect counts at the round's top.
- Holder token deleted: its effects go; effects that end with its focus go too.
- A duplicated map copies its effects, as it copies the tracker.
- Round 0, phase switches, Reset rounds: covered above.
- Two GM clients: one background page sends notices (the lowest connection id, as with players' lights).
- A free-standing focus effect: not allowed (focus needs a caster).
- Dice durations: one roll for a batch, shown in the effect, undoable with the add.
- Cap reached: the form says so; ended effects are cleared first.
- Players: read-only chips, strip and reminder; nothing hidden is drawn, nor the effects of a token hidden from them.

## Review log

- Pass 1: Nat 1 page fixed to p. 45 with the wizard / priest outcomes; no chains of ends-with; Time passes leaves focus and until-removed alone; when ◀ stops bringing an ended effect back; the scene test as a Dev-only button, not by hand; Settings switch for map icons; nat 20 noted as not tracked; players' closed-panel notice deferred.
- Pass 2: actions writing two keys (one step, after both land); effects on a token outside initiative listed in the strip.
- Pass 3: holder vs counts-on row when removed from initiative; hidden tokens' effects. Further passes found only wording.

## Build order (v0.4, after v0.3 ships)

1. Scene limit test on Dev (above); note caps if needed.
2. Pure rules `src/effects.ts` + tests (parse, add, remove, derived rounds left, Reset rounds, Time passes, focus and ends-with).
3. Panel: chips, strip, reminders, Add effect form, row menu; players' view.
4. Map icons (art: 8 condition icons + "+", WebP), notices, right-click entry.
5. Room test (GM + player), then the death timer can reuse it later (rounds on the holder's turn, a d20 prompt).
