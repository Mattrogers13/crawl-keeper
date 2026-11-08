---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-07
**In flight:** nothing. v0.6.0 released 2026-11-07 (combine/expand folded in).
**Waiting on:** Matt walking TESTING.md on Dev (new rows 113 to 124, reworded rows 3, 34, 49, 62, 69, 70, 103, 110 have blank dates), then "merge".
**Resume here:** UI design pass, PR 2 (list space: one bottom row, the links row gone, the combat card dropped, no checkboxes on a mouse, scroll to the current turn). PR 1 (#58, 2026-11-08) is merged and live, unreleased: round count fits, slim amber Pause bar, no confirms on Undo-covered actions, no Undo toast, Redo icon, Manual reminder every N rounds, scrollbar gap. Review and mockups: `docs/ui-review-2026-11-07/` (REPORT.md, mockups.html; also https://claude.ai/artifact/LHqjWuuB7XmECsBkigG2cX). Decisions in docs/design.md "UI review decisions". After PR 2: the death prompt (then test the dying counter running a round early), stacked identical monsters, the Light Tracker opening the ⏳ sheet. Waiting on Matt: the Manual die in darkness (labelled d8, rolls d6; a d8 "encounter on 1" would make darkness safer). Untested: right-clicking the clock with a mouse. Also open: add-to-initiative hotkey, breadcrumbs idea (design.md), Sort-by-roll possible deletion, one unexplained in-room placement (design.md), snapping trim (low).

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
