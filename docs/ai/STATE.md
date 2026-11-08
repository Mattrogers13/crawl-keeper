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
**Resume here:** UI design pass. Review: `docs/ui-review-2026-11-07/REPORT.md`; mockups and Matt's answers (2026-11-08): `docs/ui-review-2026-11-07/mockups.html` (also a private claude.ai artifact, https://claude.ai/artifact/LHqjWuuB7XmECsBkigG2cX), branch `docs/ui-review`. Decided: Q1 B (amber trial), Q2 A, Q3 try A, Q4 A, Q5 B plus a reminder pulse, Q6 redesign (Failed big, Skip for now so ▶ never freezes), Q7 A, Q8 keep. Q5 pulse: every N crawl rounds on the GM turn, default 3 (Unsafe's cadence, p. 112), GM sets N in Settings. Q6: "Failed · <name> dies" on the last turn marks them dead at once (already how notTwenty works: one undo step). Q9: build A (reclaim space) + C (stack identical monsters); B (resize via OBR.action.setHeight) held in reserve if A+C don't work in play; plus auto-scroll to the current turn. Next: Matt picks a start. Tracked: the dying counter ran a round early last session: test after the design stage. Also open: add-to-initiative hotkey, breadcrumbs idea (design.md), Sort-by-roll possible deletion after two more sessions, one unexplained in-room placement (design.md), snapping 48 spots per switch could be trimmed (low). Rows with a blank date in TESTING.md weren't room-tested for v0.6.0.

**Notes:**
- Latest release: v0.6.0 (2026-11-07), tag `v0.6.0`. Before it: v0.5.0 (2026-11-06), `6eb9792`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
