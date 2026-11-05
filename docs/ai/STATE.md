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

**Resume here:** v0.4 step 1 done 2026-11-05: Matt's Dev run accepted 65 kB on one scene, no cap reached, and `undefined` deletes a key (recorded in gotchas, effects, design). No cap changes needed. PR #39 (the test button plus Dev manifests showing `0.3.0-dev.<sha>`) waits on Matt's "merge". Then step 2: pure rules `src/effects.ts` + tests (`docs/effects.md`).

**In flight right now:**
- PR #39, the Dev-only scene size test (removed or kept Dev-only after the result; it never shows on live).

**Working agreements (cold start):**
- Merge only on Matt's explicit "merge". Before asking him to test: confirm the Dev bundle has the commit and remind him to reload the room.
- Room tests: walk him through one section at a time, numbered steps with what to expect; record results in TESTING.md.
- Effects order (Matt, 2026-11-01): v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
