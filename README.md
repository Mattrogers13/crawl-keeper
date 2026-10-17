# Crawl Keeper

An [Owlbear Rodeo](https://owlbear.rodeo) extension for running old-school dungeon crawls: an initiative tracker (sorted by roll, with a GM / Monsters row and its monsters, notes, and a turn marker on the map), crawling and combat states, and encounter checks or the crawling clock on the GM's turn. The GM runs it; players see a read-only view.

**Status:** v0.1.0 released (see [`CHANGELOG.md`](CHANGELOG.md)). Next: v0.2, encounter and morale rollers. The plan is in [`docs/design.md`](docs/design.md).

**How to use it:** the guide is at [crawl-keeper.editbag.workers.dev](https://crawl-keeper.editbag.workers.dev/) (also linked from the panel's Settings).

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
