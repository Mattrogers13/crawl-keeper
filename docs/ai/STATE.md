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

**Resume here:** v0.4 step 3 (the effects panel) built 2026-11-05 on `feat/effects-panel`, PR open, on Dev. Waiting on Matt's room test: TESTING.md rows 77–84 (GM + player), one section at a time. Then merge on his word, and step 4: map icons (art: 8 condition icons + "+", WebP; design canvas in memory), ended notices from the GM's background, right-click Add effect, Settings → Effect icons on the map.

**In flight right now:**
- The effects panel PR (`feat/effects-panel`), on Dev. Steps 1 (#39) and 2 (#40) are merged.

**Working agreements (cold start):**
- Merge only on Matt's explicit "merge". Before asking him to test: confirm the Dev bundle has the commit and remind him to reload the room.
- Room tests: walk him through one section at a time, numbered steps with what to expect; record results in TESTING.md.
- Effects order (Matt, 2026-11-01): v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
