---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-07
**In flight:** v0.6.0 release PR #57 (`release/v0.6.0` to `main`), now with combine/expand folded in (Matt, 2026-11-07): Party token and Party | Split (the party travels attached, wall-safe gathering, Combat splits), Hand light to…, the GM lights any light on props, Rename…, manual die and rolls eye, Show-not-hide settings, spent lights stay out, Light Tracker (i) popup, Pause button and Paused bar, grouped right-click menu. Dev-only room check and debug log removed. Dev (`dev`) carries it.
**Waiting on:** Matt walking TESTING.md on Dev (new rows 113 to 124, reworded rows 3, 34, 49, 62, 69, 70, 103, 110 have blank dates), then "merge".
**Resume here:** walk Matt through the whole TESTING.md one section at a time (rows 72, 130, 131 new or changed; 113-129 passed 2026-11-07 on Dev) and record each row's date; after "merge": squash, tag `v0.6.0`, confirm live, update CLAUDE.md status. Still open: add-to-initiative hotkey (keys typed on the map may not reach the panel), breadcrumbs idea (design.md), Sort-by-roll possible deletion after two more sessions, one unexplained in-room placement (design.md).

**Notes:**
- Latest release: v0.5.0 (2026-11-06), tag `v0.5.0`, `6eb9792` (v0.6.0 pending). Before it: v0.4.0 (2026-11-06), `d9fee97`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
