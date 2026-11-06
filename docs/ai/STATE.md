---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-05
**In flight:** v0.4 step 4b, right-click → Crawl Keeper → Add effect…: PR (`feat/effects-right-click`; `src/addEffectHandoff.ts`, row in `mapMenu.ts`, wiring in `menu.ts`, `Panel.tsx`, `Tracker.tsx`). Step 4a (#43, effect notices + hidden-chip fix) merged and live.
**Waiting on:** Matt's "merge" of #44 (row 87 passed 2026-11-05).
**Resume here:** after merge: 4c map icons (draft the 9 icons in the light-badge style and show Matt before wiring). New branch off `main`.

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
