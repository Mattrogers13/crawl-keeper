# Deploy: Cloudflare Workers (static assets) + Owlbear installs

The same setup Torchlight uses. Workers Builds builds on every push: `main` deploys production, other branches get preview URLs.

## One-time setup (dashboard steps can't be templated)

1. Set `name` in `wrangler.jsonc` (the worker name, e.g. `my-extension`).
2. Push the repo to GitHub.
3. Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick the repo.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Non-production branch builds: enable them so branches get preview URLs.
   - (These are from memory, not copied from Torchlight's dashboard: check them against the dashboard's defaults and fix this doc.)
4. Production URL: `https://<name>.<subdomain>.workers.dev`. PR/branch previews: `https://<branch>-<name>.<subdomain>.workers.dev` (posted as a PR comment).
5. Update `homepage_url` in `public/manifest.json`.

Check before pushing: `npx wrangler deploy --dry-run` (validates config), `npx wrangler dev --port 8799` (serves `dist/` like production).

Build logs aren't reachable from the CLI (the GitHub check has no log): download them from the dashboard.

## Two installs in Owlbear, each added once

- **Live:** `https://<name>.<subdomain>.workers.dev/manifest.json`
- **Dev:** a long-lived `dev` branch → `https://dev-<name>.<subdomain>.workers.dev/manifest.json`. Its manifest is renamed "(Dev)" automatically (`src/devManifest.ts`), so the two can't be confused.

To review open PRs in Owlbear, rebuild `dev` from main plus the branches and force-push it:

```bash
git checkout -B dev origin/main && git merge --no-edit <branches...> && git push -f origin dev
```

`dev` is disposable: never PR from it or merge it into main. Don't ask testers to install per-PR previews.

## Local development

`npm run dev` serves on `http://localhost:5173` with CORS on. In Owlbear, add a custom extension with `http://localhost:5173/manifest.json`. (Owlbear is HTTPS; Chrome allows `http://localhost` as a secure context. Other browsers: unverified.)

## Release

- Bump `version` in both `package.json` and `public/manifest.json` (semver).
- Branch + PR per change; squash-merge after CI and Workers Builds both pass.
- Features that need in-Owlbear testing stay open until a manual pass in a real room (GM + a player in a private window).

## Publishing to the Owlbear extension store

The store is a GitHub repo: github.com/owlbear-rodeo/extensions (`extensions.json`, `tags.json`). Follow the "showcase your extension" tutorial on docs.owlbear.rodeo (open it in a browser; it blocks bots).
