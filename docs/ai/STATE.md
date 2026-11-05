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

**Resume here:** v0.4 step 1 built: PR #39 (`feat/scene-size-test`), on Dev as `382d2fb`. Waiting on Matt to run Settings → About → Scene size test (Dev) in a room and report the line it prints. Then: record the cap in `docs/obr/gotchas.md` (and whether `undefined` deletes a key), decide on the 80-character note cap if scenes cap at 16 kB, merge #39 on Matt's word, start step 2 (`src/effects.ts`). Effects add about 3.6 kB per scene on top of the tracker's ~12.7 kB worst case.

**In flight right now:**
- PR #39, the Dev-only scene size test (removed or kept Dev-only after the result; it never shows on live).

**Working agreements (cold start):**
- Merge only on Matt's explicit "merge". Before asking him to test: confirm the Dev bundle has the commit and remind him to reload the room.
- Room tests: walk him through one section at a time, numbered steps with what to expect; record results in TESTING.md.
- Effects order (Matt, 2026-11-01): v0.4 effects, then v0.5 Dice+, morale, encounter tables, End tracker.
