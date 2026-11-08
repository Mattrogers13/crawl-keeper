---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-08
**In flight:** PR #63 `feat/death-prompt`, room-tested (TESTING rows 142 to 148 passed 2026-11-08), waiting on Matt's "merge": the death prompt by frequency (big Failed, Skip for now, opens on the dying turn), Dying in two steps (mark when they drop, roll the timer on their turn), turns-left label, and an Undo fix (two steps at once on a new map). Merged and live, unreleased: #58, #60, #61.
**Waiting on:** Matt's "merge" for #62 (this file) and #63.
**Resume here:** UI design pass, next PR: stacked identical monsters (Q9 C; the resize grip B already exists), then the Light Tracker opening the ⏳ Time passes sheet. The dying counter "a round early": traced to the label ("1 round left" before a last chance), now counted in turns; the timing matched p. 89. Review and mockups: `docs/ui-review-2026-11-07/` (also https://claude.ai/artifact/LHqjWuuB7XmECsBkigG2cX). Untested: right-clicking the clock with a mouse. Also open: add-to-initiative hotkey, breadcrumbs idea (design.md), Sort-by-roll possible deletion, one unexplained in-room placement (design.md), snapping trim (low).
**Tracked task (fix by the stacked-monsters PR; not reproduced during the death-prompt PR):** CI flake, `Effects.test.tsx` "a row's effects sit under it…" failed once on #61's merge commit (getByRole "Bless · 2 of 2 rounds left" right after clicking "Show 2 effects"), passed on rerun and 9 local runs. Suspect: a late room read resets `RowEffects`' `chosen` (or remounts it) after the click; find the cause, don't just add a waitFor.

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
