# CLAUDE.md

Shadowdark crawl companion for Owlbear Rodeo: initiative tracker (sorted by roll, GM / Monsters row with its monsters, notes, dead, a per-token turn marker on the map, batch row menu), Crawl/Combat with one round count, encounter checks or the Crawling Clock on the GM's turn; v0.2 adds encounter and morale rollers. v0.1.0 released 2026-10-16. **The agreed design, data layout and release plan are in `docs/design.md`; read it before building.** GM is the only writer; players get a read-only view.

Built from Matt's `obr-extension-starter` template. React 19 + Vite + TypeScript 5 + Tailwind 4, hosted on Cloudflare Workers static assets.

## Setup and open items

- If `sources/sdk` is missing: `scripts/fetch-sources.sh`. Original ask: `BRIEF.md` (DONE).
- Installs: live `https://crawl-keeper.editbag.workers.dev/manifest.json`, Dev `https://dev-crawl-keeper.editbag.workers.dev/manifest.json` (`docs/obr/deploy.md`). After a Dev rebuild, reload the Owlbear room: the background page loads once per room.
- Tracked tasks and undecided review candidates: `docs/design.md` "Releases".
- Status (2026-10-16): v0.1.0 released (tagged): Owlbear-native look, Keeper's key icon, how-to homepage, revamped Settings. Next: v0.2 (encounter and morale rollers) and picking from the review candidates in `docs/design.md`.

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
# Dev build live? The bundle carries dev's commit hash (footer label; dev gets merge commits):
js=$(curl -s https://dev-crawl-keeper.editbag.workers.dev/ | grep -o 'assets/main-[^"]*\.js' | head -1); curl -s "https://dev-crawl-keeper.editbag.workers.dev/$js" | grep -c "$(git rev-parse --short origin/dev)"
```

Node 24 (`.node-version`; fnm auto-switches). Non-interactive shells: `eval "$(fnm env --shell zsh)" && fnm use` first.

## Architecture

- `src/main.tsx`: `OBR.isAvailable` (page has `?obrref`) → `App`, else `Homepage` (the public how-to guide; Settings links to it). `ClockRules.tsx` is shared by both.
- `src/components/App.tsx`: waits for `OBR.onReady`, applies Owlbear's theme (`useObrTheme`), waits for the role (`useRole`), renders `Panel`.
- `src/hooks/useRoomValue.ts`: one metadata key (`useRoomValue` / `useSceneValue`), parsed on every read, no writes before the first read, failed writes revert. **Single writer per key.**
- Pure rules (no SDK, no React; unit-tested): `src/tracker.ts` (the scene's tracker doc: entries, turns, phases, rounds), `src/crawl.ts` (checks and the Crawling Clock, stored in the tracker doc), `src/selection.ts` (row selection), `src/parse.ts` (untrusted-data helpers).
- `components/Tracker.tsx` renders it (the list, drag, batch selection, the GM's N / B / R hotkeys on a window listener; a row and its inputs in `TrackerRow.tsx`, the row menu in `RowMenu.tsx`, icons in `icons.tsx`) and portals into `Panel`'s two slots: `CrawlBar` under the title, the round count beside it. `Settings.tsx` holds the room settings (`src/settings.ts`). `useSceneReady` remounts the tracker per opened scene.
- `src/marker.ts`: the turn-marker ring and selecting the current token. Moved only from the GM's clicks via `afterTurnChange` (syncs run one at a time), plus deleting the current token from the map. Ring visibility is matched by hand (attachments don't inherit it).
- `src/background.ts` (every client, panel open or not): the GM's right-click "Add / Remove Initiative", the combat alert, the GM's ring-visibility fix.
- `src/constants.ts`: extension `ID` (prefixes every metadata key and broadcast channel) and keys. No React imports (background pages use it).
- `src/storage.ts`: the only way to touch localStorage (it throws in Owlbear's iframe under strict privacy).
- `src/devManifest.ts` + `vite.config.ts`: non-main Cloudflare builds rename the manifest "(Dev)" and show `DEV · branch · sha` in the footer.
- Testing drag (dnd-kit) in jsdom: stub `getBoundingClientRect` per row and give the list a tall box, then press Space / arrows / Space with a pause between (`Tracker.test.tsx`, "drag to move").
- Styling: Owlbear's theme colors as CSS vars (`--obr-*`) → Tailwind classes `bg-obr-paper`, `text-obr-text`, `bg-obr-primary`, etc. (`src/index.css`).

## Owlbear rules (don't break; details in docs/obr/gotchas.md)

- No SDK call before `OBR.onReady`. Unsubscribe every `onX` on unmount. `.catch` every un-awaited SDK promise.
- Everything from room metadata or broadcasts is untrusted: parse it. Permissions are client-side only.
- Room metadata: 16 kB total across all extensions; never write before the first read lands.
- Several clients writing the same data: read `docs/obr/room-sync.md` first.
- Images drawn on the map (items, attachments) and the manifest icon: never SVG (black square). Raster images are WebP (lossless for icons) except the manifest icon (PNG).
- Use extensionless URLs for extra pages (`/background`, `/menu`); Cloudflare 307s `.html`.
- `public/_headers` CORS header is required; don't remove it.
- Attachments don't inherit their parent's visibility: set it and re-match it (`src/marker.ts`). SDK calls can reject with plain objects: use `errorMessage`. Item syncs from quick clicks race: run them one at a time with a fresh read.

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
- Merge only on Matt's explicit "merge"; a passed room test alone isn't the go-ahead.
- Before asking Matt to test: confirm the Dev bundle has the commit (command above), and remind him to reload the Owlbear room (the background page loads once per room).
- No prettier/formatter in this repo: don't run one (it rewrites whole files); match the surrounding style by hand.
- Rules questions: quote the book. `pdftotext -layout "sources/Shadowdark RPG - V4-8.pdf" <scratch>/sd.txt` then grep; the clock rules are `sources/CrawlingClock_Rules.jpeg`. Cite page numbers.
- Review in Owlbear via the `dev` branch install, not per-PR previews (`docs/obr/deploy.md`).
- Updating `dev` without force-push (blocked in auto mode): `git checkout dev && git merge --no-edit <branch>`; on conflicts, check `git diff --quiet HEAD origin/main` (dev's files = main's), then `git checkout <branch> -- . && git commit --no-edit`.
- See a panel component without Owlbear: render it in a throwaway vitest file, write `container.innerHTML` to scratch, wrap it with `dist/assets/*.css` (after `npm run build`), screenshot with headless Chrome (dark: `class="dark"`; light: override the `--obr-*` vars). The homepage: `npx vite preview` + screenshot.
- Rules text shown in the app (book or Crawling Clock sheet): our own words plus credit (`src/components/ClockRules.tsx`), never the source text.
- Versions: semver, same value in `package.json` and `public/manifest.json` (a test enforces it).
- A regression test must fail on the old code (`docs/obr/testing.md`).
- No analytics or third-party requests without asking.
