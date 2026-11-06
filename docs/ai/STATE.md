---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-06
**In flight:** nothing open. v0.5 so far, merged and live (unreleased, CHANGELOG "Unreleased"): the death timer (#52) and Dice+ (#53).
**Waiting on:** a player session for TESTING.md rows 104–112 (109–110 settle the Dice+ unknowns: LOCAL vs ALL, `1d6!`, "everyone" visible to players). No per-PR room test (Matt, 2026-11-06).
**Resume here:** whatever Matt picks next. On hold: morale and encounter roll tables. Release v0.5.0 when Matt wants it (full TESTING.md walkthrough).

**Notes:**
- Latest release: v0.4.0 (2026-11-06), tag `v0.4.0`, `d9fee97`. Before it: v0.3.0 (2026-11-02), `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
