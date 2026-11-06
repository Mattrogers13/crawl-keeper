---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-06
**In flight:** v0.5: the death timer (PR #52, `feat/death-timer`) and Dice+ (PR #53, `feat/dice-plus`, stacked on #52), both on Dev `28c5e00`. PR #51 (post-v0.4.0 docs) open too. Plan: `~/.claude/plans/async-mapping-scott.md`.
**Waiting on:** Matt poking around on Dev and asking for changes, then a player session (TESTING.md rows 104–112; 109–110 settle the Dice+ unknowns: LOCAL vs ALL, "everyone" visible to players). No per-PR room test (Matt, 2026-11-06). Merge only on "merge"; retarget #53 to main before deleting `feat/death-timer`.
**Resume here:** Matt's feedback on the death timer and Dice+. On hold: morale and encounter roll tables.

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
