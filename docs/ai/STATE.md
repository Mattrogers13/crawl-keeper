---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-08
**In flight:** nothing open. Merged and live, unreleased (all TESTING rows 132 to 157 passed 2026-11-08): #58, #60, #61, #63, #64, #65 (stacks), #66 (Edit… an effect), #67 (monster HP).
**Waiting on:** Matt: the v0.7.0 release walk (full TESTING.md, one section at a time) when he starts it.
**Resume here:** cut v0.7.0: one PR to `main` (version bump in `package.json`, `public/manifest.json` and the two own `version` fields of `package-lock.json`; CHANGELOG `## v0.7.0 (date)`; new TESTING rows), walk Matt through TESTING.md, then tag and confirm live (`docs/obr/deploy.md` "Release"). Resolve the CI flake task below first. The Light Tracker / ⏳ sheet item from the UI review is dropped: Matt checked the existing sheet and it works well. Later ideas: "Copy HP from…" across scenes, stat blocks (not scheduled). Untested: right-clicking the clock with a mouse. Also open: add-to-initiative hotkey, breadcrumbs idea, Sort-by-roll possible deletion, one unexplained in-room placement, snapping trim (low).
**Tracked task (deadline: the v0.7.0 release):** CI flake, `Effects.test.tsx` "a row's effects sit under it…" failed once on #61's merge commit (getByRole "Bless · 2 of 2 rounds left" right after clicking "Show 2 effects"). Not reproduced: 60 repeats and 25 full-file runs under CPU load all passed; ruled out the Undo map-id race and remounts (stable keys). Guess: the fold button replaced between findByRole and the click. Don't just add a waitFor.

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
