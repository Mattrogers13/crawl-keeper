---
status: active        # running | active | paused | archive | archived (dashboard status.json is the source of truth)
kind: web-app         # web-app | obsidian-plugin | script-utility | config-backup | skills-tooling | other
---

<!-- OWNS: current in-flight work only. UPDATE: every checkpoint (prune finished items).
     NOT HERE: design and decisions (→ docs/design.md, docs/effects.md), release history (→ CHANGELOG.md).
     Keep this SHORT; it's read at the start of every session. -->

# Current State

**Last updated:** 2026-11-02

**Latest release:** v0.3.0 (2026-11-02): the Torchlight merge. Squash `ee30f22` on `main` (#36), tag `v0.3.0`, live manifest reads 0.3.0. Full TESTING.md pass 2026-11-01/02, every row passed (51–55 retired).

**Resume here:** when Matt says go, branch from `main` for v0.4 effects (`docs/effects.md`, build order step 1): a Dev-only Settings button that writes a 20 kB test key to the open scene, reads it back, deletes it and reports the result. Matt clicks it in the room. If scenes share a 16 kB cap, lower tracker notes from 200 to 80 characters before step 2 (pure rules, `src/effects.ts`). Don't build effects before the result: effects add about 3.6 kB per scene on top of the tracker's ~12.7 kB worst case, and the scene limit is undocumented (12 kB verified). Nothing is mid-flight.

**In flight right now:**
- Nothing open besides this docs PR. `dev` matches `main`'s app code; `torchlight-merge` is kept for the per-PR history of v0.3.

**Working agreements (cold start):**
- Merge only on Matt's explicit "merge". Before asking him to test: confirm the Dev bundle has the commit and remind him to reload the room.
- Room tests: walk him through one section at a time, numbered steps with what to expect; record results in TESTING.md.
- Effects order (Matt, 2026-11-01): v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
