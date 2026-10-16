# Crawl Keeper

An [Owlbear Rodeo](https://owlbear.rodeo) extension for running old-school dungeon crawls: an initiative tracker (sorted by roll, with a GM / Monsters row, notes and monster HP), crawling and combat states, and encounter checks or the crawling clock on the GM's turn. The GM runs it; players see a read-only view.

**Status:** in development (v0.1 in progress). The plan is in [`docs/design.md`](docs/design.md).

## Install

In Owlbear Rodeo: Extensions → Add Custom Extension → paste this manifest URL:

```
https://crawl-keeper.editbag.workers.dev/manifest.json
```

Testing builds from the `dev` branch (named "Crawl Keeper (Dev)"): `https://dev-crawl-keeper.editbag.workers.dev/manifest.json`. Install one or the other in a room, not both.

Crawl Keeper is an independent project, not affiliated with or endorsed by any game publisher. It contains no rulebook text.

## Development

React 19, Vite, TypeScript, Tailwind 4, vitest with an in-memory Owlbear SDK, hosted on Cloudflare Workers. Built from the `obr-extension-starter` template; see `CLAUDE.md` for commands and `docs/obr/` for Owlbear notes.

## Credits

Coded by Claude (Anthropic) via Claude Code, directed by Matthew Rogers. MIT licensed.
