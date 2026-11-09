---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-08
**In flight:** monster HP on `feat/monster-hp` (PR open, on Dev once pushed): HP on the tracker entry, a box on each monster row, one box on a stack's line, skull at 0, a new monster inherits its kind's max (design.md "Monster HP"). TESTING rows 154 to 157 NOT yet run. Merged and live, unreleased: #58, #60, #61, #63, #64, #65, #66 (TESTING 132 to 153 passed).
**Waiting on:** Matt: rows 154 to 157 on Dev (check the footer hash, reload the room), then "merge".
**Resume here:** after the merge: the Light Tracker opening the ⏳ Time passes sheet (UI review Q4, last item of the pass), or cut v0.7.0 (full TESTING.md walk first). Later ideas: "Copy HP from…" across scenes, stat blocks (not scheduled). Review and mockups: `docs/ui-review-2026-11-07/`. Untested: right-clicking the clock with a mouse. Also open: add-to-initiative hotkey, breadcrumbs idea, Sort-by-roll possible deletion, one unexplained in-room placement, snapping trim (low).
**Tracked task (deadline: the v0.7.0 release):** CI flake, `Effects.test.tsx` "a row's effects sit under it…" failed once on #61's merge commit (getByRole "Bless · 2 of 2 rounds left" right after clicking "Show 2 effects"). Not reproduced: 60 repeats and 25 full-file runs under CPU load all passed; ruled out the Undo map-id race and remounts (stable keys). Guess: the fold button replaced between findByRole and the click. Don't just add a waitFor.

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
