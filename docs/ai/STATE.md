---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-05
**In flight:** nothing. v0.4 steps 1–3 merged to `main` (live, unreleased): #39 scene limit 65 kB+, #40 `src/effects.ts`, #41 the effects panel (with notes on demand: token rows open a note from the row menu), and #42 (Dev manifest version cut to Owlbear's 16 characters). Room-tested 2026-11-05: TESTING.md rows 2, 77–84.
**Waiting on:** nothing.
**Resume here:** v0.4 step 4 (`docs/effects.md` build order): map icons, ended notices, right-click Add effect. Branch off `main`.

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
