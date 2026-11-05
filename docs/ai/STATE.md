---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Last updated:** 2026-11-05

**Latest release:** v0.3.0 (2026-11-02): the Torchlight merge. Squash `ee30f22` on `main` (#36), tag `v0.3.0`, live manifest reads 0.3.0. Full TESTING.md pass 2026-11-01/02, every row passed (51–55 retired).

**Resume here:** v0.4 step 2 built 2026-11-05: `src/effects.ts` + 25 tests on `feat/effects-rules` (PR open, waits on Matt's "merge"; pure rules, nothing in the UI, no room test). Step 1's result: scenes take 65 kB+, no cap changes. Next: step 3, the panel (chips, strip, reminders, Add effect form, row menu, players' view), wiring `${ID}/effects` into undo (`restoreEffects`), Reset rounds, Time passes and Mark dead. That step needs a Dev room test.

**In flight right now:**
- The effects rules PR (`feat/effects-rules`). Stores each rounds effect's end, not its start (noted in `docs/effects.md`). Worst case measured at 6.5 kB per map, not 3.6.

**Working agreements (cold start):**
- Merge only on Matt's explicit "merge". Before asking him to test: confirm the Dev bundle has the commit and remind him to reload the room.
- Room tests: walk him through one section at a time, numbered steps with what to expect; record results in TESTING.md.
- Effects order (Matt, 2026-11-01): v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
