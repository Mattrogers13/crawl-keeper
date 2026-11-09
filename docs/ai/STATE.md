---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-08
**In flight:** two PRs live on Dev (`dev` = main + both), awaiting Matt's "merge": #65 `feat/stack-monsters` (identical monsters share one line, "Zombie ×3"; TESTING 149 to 151 passed 2026-11-08) and #66 `feat/edit-effect` (Edit… in an effect's menu; rows 152 and 153 NOT yet run). #64 is this file. Merged and live, unreleased: #58, #60, #61, #63 (TESTING 132 to 148 passed).
**Waiting on:** Matt: rows 152 and 153 on Dev (footer `04658da`, reload the room), then "merge" for #64, #65, #66. #66 is built off main (no stacks), so after #65 merges, merge main into #66 (docs conflicts: keep both sides) and re-run tests.
**Resume here:** after the merges: the Light Tracker opening the ⏳ Time passes sheet (UI review Q4, last item of the pass), or cut v0.7.0 (full TESTING.md walk first). Future, not scheduled: monster HP with math in the box ("-2", "+4"), maybe stat blocks (design.md). Review and mockups: `docs/ui-review-2026-11-07/`. Untested: right-clicking the clock with a mouse. Also open: add-to-initiative hotkey, breadcrumbs idea, Sort-by-roll possible deletion, one unexplained in-room placement, snapping trim (low).
**Tracked task (deadline: the v0.7.0 release):** CI flake, `Effects.test.tsx` "a row's effects sit under it…" failed once on #61's merge commit (getByRole "Bless · 2 of 2 rounds left" right after clicking "Show 2 effects"). Not reproduced: 60 repeats and 25 full-file runs under CPU load all passed; ruled out the Undo map-id race and remounts (stable keys). Guess: the fold button replaced between findByRole and the click. Don't just add a waitFor.

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
