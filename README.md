# OBR Extension Starter

A starter for [Owlbear Rodeo](https://owlbear.rodeo) extensions: React 19, Vite, TypeScript, Tailwind 4, vitest with an in-memory Owlbear SDK, and Cloudflare Workers hosting. It also carries the lessons from building [Torchlight](https://github.com/Mattrogers13/obr-torchlight).

## Use it

This is a starting point for Claude Code, not an extension to install.

1. Duplicate this folder and give the copy the new extension's name. Keep the master named `obr-extension-starter`: the brief only auto-opens in copies.
2. Optional: delete the copy's `.git` and `git init` for a clean history.
3. Start Claude Code in the copy. `BRIEF.md` opens in Sublime Text (or VS Code). Fill it in, set `Status: DONE`, and tell Claude.
4. Claude asks follow-ups, proposes components, and builds from there (see `CLAUDE.md`).

`sources/` (the SDK source) and `node_modules/` come along with the copy. To refresh the SDK: `scripts/fetch-sources.sh`.

## What's in it

- A working panel: waits for Owlbear, follows its theme, knows GM vs player, and shares a note through room metadata (the example to replace).
- Tests for all of the above against `src/test/obrMock.ts`, plus manifest and storage guards.
- `docs/obr/`: gotchas, patterns, multi-writer sync lessons, testing and deploy guides.
- CI (GitHub Actions) and Cloudflare Workers config with dev/preview builds.

Coded with AI (Claude Code). MIT licensed.
