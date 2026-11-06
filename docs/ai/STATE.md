---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-05
**In flight:** v0.4 step 4a, effect notices: PR #43 (`feat/effects-map`; `src/effectNotices.ts`, started in `background.ts`), on Dev as `0.3.0-dev.cb236c`. Steps 1–3 merged to `main` (live, unreleased), with #42 (Dev manifest version cut to 16 characters).
**Waiting on:** Matt's room test of TESTING.md row 85, then his "merge".
**Resume here:** after #43: step 4b, right-click → Crawl Keeper → Add effect… (`OBR.action.open` from the background page is unverified; fallback: quick Focus / ADV / DIS toggles), then 4c map icons (draft the 9 icons in the light-badge style and show Matt before wiring). New branch off `main` each.

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
