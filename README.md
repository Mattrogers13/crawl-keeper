# OBR Extension Starter

A starter for [Owlbear Rodeo](https://owlbear.rodeo) extensions: React 19, Vite, TypeScript, Tailwind 4, vitest with an in-memory Owlbear SDK, and Cloudflare Workers hosting. It also carries the lessons from building [Torchlight](https://github.com/Mattrogers13/obr-torchlight).

## Use it

1. Create a repo from this template (GitHub: "Use this template").
2. `npm install && scripts/fetch-sources.sh`
3. Follow "First run" in `CLAUDE.md`.
4. `npm run dev`, then in Owlbear add the custom extension `http://localhost:5173/manifest.json`.

## What's in it

- A working panel: waits for Owlbear, follows its theme, knows GM vs player, and shares a note through room metadata (the example to replace).
- Tests for all of the above against `src/test/obrMock.ts`, plus manifest and storage guards.
- `docs/obr/`: gotchas, patterns, multi-writer sync lessons, testing and deploy guides.
- CI (GitHub Actions) and Cloudflare Workers config with dev/preview builds.

Coded with AI (Claude Code). MIT licensed.
