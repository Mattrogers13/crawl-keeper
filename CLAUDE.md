# CLAUDE.md

Owlbear Rodeo extension built from Matt's `obr-extension-starter` template. React 19 + Vite + TypeScript 5 + Tailwind 4, hosted on Cloudflare Workers static assets.

## First run (this folder was duplicated from the starter for a new extension)

1. **Brief.** `BRIEF.md` is the user's questionnaire. A SessionStart hook (`scripts/open-brief.sh`) opens it in their editor while it says `Status: DRAFT`. Don't build features until it says `Status: DONE`. Then read it, follow `docs/obr/capabilities.md` (follow-ups one at a time, then a component/data/scope proposal), and wait for approval.
2. If `sources/sdk` is missing: `scripts/fetch-sources.sh`.
3. Replace placeholders: `ID` in `src/constants.ts`, `name`/`description`/`homepage_url` in `public/manifest.json`, `name` in `package.json` and `wrangler.jsonc`, `<title>` in `index.html`, the art in `art/` + `public/img/`.
4. Replace the example note (`src/note.ts`, `Panel.tsx`, `NOTE_KEY`) with the real feature.
5. Cloudflare setup when ready to deploy: `docs/obr/deploy.md`.
6. Rewrite this section as the project's overview (keep `BRIEF.md` as the record of the original ask; set its hook aside by leaving it DONE).

## Commands

```bash
npm install
npm run dev          # localhost:5173, CORS on; add http://localhost:5173/manifest.json in Owlbear
npm test             # vitest + jsdom, in-memory OBR SDK
npm run typecheck    # tsc --noEmit (no ESLint; this is the lint)
npm run build        # typecheck + vite build
npx wrangler deploy --dry-run   # validate Cloudflare config
npx wrangler dev --port 8799    # serve dist/ like production
scripts/render-png.sh art/x.svg public/img/x.png 256   # SVG → PNG via headless Chrome
```

Node 24 (`.node-version`; fnm auto-switches). Non-interactive shells: `eval "$(fnm env --shell zsh)" && fnm use` first.

## Architecture

- `src/main.tsx`: `OBR.isAvailable` (page has `?obrref`) → `App`, else `Homepage`.
- `src/components/App.tsx`: waits for `OBR.onReady`, applies Owlbear's theme (`useObrTheme`), waits for the role (`useRole`), renders `Panel`.
- `src/hooks/useRoomValue.ts`: one room-metadata key, parsed on every read, no writes before the first read, failed writes revert. **Single writer per key.**
- `src/constants.ts`: extension `ID` (prefixes every metadata key and broadcast channel) and keys. No React imports (background pages use it).
- `src/storage.ts`: the only way to touch localStorage (it throws in Owlbear's iframe under strict privacy).
- `src/devManifest.ts` + `vite.config.ts`: non-main Cloudflare builds rename the manifest "(Dev)" and show `DEV · branch · sha` in the footer.
- Styling: Owlbear's theme colors as CSS vars (`--obr-*`) → Tailwind classes `bg-obr-paper`, `text-obr-text`, `bg-obr-primary`, etc. (`src/index.css`).

## Owlbear rules (don't break; details in docs/obr/gotchas.md)

- No SDK call before `OBR.onReady`. Unsubscribe every `onX` on unmount. `.catch` every un-awaited SDK promise.
- Everything from room metadata or broadcasts is untrusted: parse it. Permissions are client-side only.
- Room metadata: 16 kB total across all extensions; never write before the first read lands.
- Several clients writing the same data: read `docs/obr/room-sync.md` first.
- Images drawn on the map (items, attachments) and the manifest icon: never SVG (black square). Raster images are WebP (lossless for icons) except the manifest icon (PNG).
- Use extensionless URLs for extra pages (`/background`, `/menu`); Cloudflare 307s `.html`.
- `public/_headers` CORS header is required; don't remove it.

## Reference

- `docs/obr/capabilities.md`: brief answers → SDK APIs, starter patterns, what's unverified.
- `docs/obr/gotchas.md`: everything learned the hard way, marked verified/unverified.
- `docs/obr/patterns.md`: background page, context menu, attachments, broadcast, per-player data, What's New.
- `docs/obr/room-sync.md`: multi-writer sync lessons.
- `docs/obr/testing.md`: the OBR mock, test traps, regression-test check.
- `docs/obr/deploy.md`: Cloudflare + Owlbear installs + release flow.
- `sources/sdk/src`: SDK source (docs.owlbear.rodeo blocks bots). `sources/sdk-tutorials`: dated 2023, check against the SDK. Read-only.
- Worked example: github.com/Mattrogers13/obr-torchlight.

## Workflow

- Branch + PR per change; squash-merge after CI and Workers Builds pass. Features needing an Owlbear test stay open until a manual pass (GM + player in a private window).
- Review in Owlbear via the `dev` branch install, not per-PR previews (`docs/obr/deploy.md`).
- Versions: semver, same value in `package.json` and `public/manifest.json` (a test enforces it).
- A regression test must fail on the old code (`docs/obr/testing.md`).
- No analytics or third-party requests without asking.
