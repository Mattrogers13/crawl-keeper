---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-05
**In flight:** v0.4 step 3, the effects panel: PR #41 (`feat/effects-panel`; `src/components/Effects.tsx`, wiring in `Tracker.tsx`, `RowMenu.tsx`, `useLights.ts`, `undo.ts`; notes on demand in `TrackerRow.tsx`: token rows have no invisible note field, row menu → Add note, so the chips are clickable), deployed to Dev (`0.3.0-dev.0b7c20`, with #42 merged into dev). Steps 1 (#39, scene limit 65 kB+) and 2 (#40, `src/effects.ts`) are merged.
**Waiting on:** Matt's reinstall of Dev and room test. The load error's cause: Owlbear caps manifest `version` at 16 chars and `0.3.0-dev.b6c669f` is 17. Fix: PR #42 (`fix/dev-version-length`, sha cut to fit), merged into dev, waiting on Matt's "merge" to main.
**Resume here:** once Dev installs, walk TESTING.md row 2 (notes changed) and rows 77–84 one section at a time (77–79 first; row 83 is removing a chip), then merge #42 and #41 on his word (#42 first; no shared files), then step 4 (map icons, ended notices, right-click Add effect).

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
