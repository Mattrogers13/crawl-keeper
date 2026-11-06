---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Updated:** 2026-11-06
**In flight:** v0.4 step 4c, effect icons on the map: PR (`feat/effects-map-icons`; `src/effectIcons.ts` started in `background.ts`, art `art/effects/` → `public/img/effect-*.webp`, Settings → Show effect icons on the map, `effectIcons` in `settings.ts`). 4a (#43) and 4b (#44, right-click Add effect…) merged and live.
**Waiting on:** Matt's room tests: TESTING.md rows 88–90 (#45 map icons), 91–93 (#46 effects under rows + Add effects sheet), 94–96 (#47 layout B + ⏳ sheet), 97–99 (#48 session log), 100–103 (#49 effects-gone log, Reset all, rolls sort the list, what-players-see eyes). Stacked #45 ← #46 ← #47 ← #48 ← #49; merge in that order on "merge".
**Resume here:** after merge, step 4 is done; next is the v0.4.0 release PR (version bump, CHANGELOG, full TESTING.md walkthrough one section at a time). Step 5 of `docs/effects.md` (death timer) is later, not v0.4.

**Notes:**
- Latest release: v0.3.0 (2026-11-02), tag `v0.3.0`, `ee30f22`.
- Working agreements (also in CLAUDE.md): merge only on Matt's "merge"; confirm the Dev bundle and remind him to reload before a test; room tests one section at a time, results in TESTING.md. Order: v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
