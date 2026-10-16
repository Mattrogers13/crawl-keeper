# Owlbear Rodeo gotchas

Learned building Torchlight (github.com/Mattrogers13/obr-torchlight), 2026-10. Each item says how sure we are: **verified** (seen in practice or in SDK source), **Torchlight** (worked there in production), or **unverified** (believed, not confirmed; check before relying on it).

## Reading the docs

- docs.owlbear.rodeo is behind a Cloudflare bot check: WebFetch and curl fail. Read the SDK source instead: `sources/sdk/src` (run `scripts/fetch-sources.sh`), or `gh api repos/owlbear-rodeo/sdk/contents/src/...`. The compiled types are also in `node_modules/@owlbear-rodeo/sdk/lib/**/*.d.ts`. **verified**
- The SDK repo's last change was 2024-12 (v3.1.0, same as npm). The tutorials repo is from 2023-02, older than SDK 3.x. **verified**

## SDK lifecycle

- Any SDK call before Owlbear is ready throws `Unable to send message: not ready`. Gate everything on `OBR.onReady` (`App.tsx` does). **verified** (SDK `MessageBus`)
- `OBR.onReady(cb)` calls back immediately if already ready. **verified** (SDK source)
- `OBR.isAvailable` is true when the page has Owlbear's `?obrref` query param, i.e. it's embedded in Owlbear. Use it to show a homepage when opened directly. **verified**
- Every SDK call is a message to the host and returns a promise that can reject. `.catch` every one that isn't awaited, or it becomes an unhandled rejection. **Torchlight**
- Every `onX` subscription returns an unsubscribe function. Call it on unmount: panels remount (scene changes, role changes) and leaked listeners double-fire. **Torchlight**
- `getX()` then `onX()` race: an `onX` event is newer than a `getX` answer still in flight. Once an event has arrived, ignore the late answer (`useRole`, `useObrTheme`, `useRoomValue` all do this). **Torchlight**
- The role is unknown until `getRole` resolves. Render nothing role-specific until then, so a player never briefly runs GM logic (`useRole` returns `null`). **Torchlight**

## Room metadata

- **Untrusted input.** Any client and any extension can write any key. Parse everything you read (types, ranges, lengths) before using it. Permissions (GM vs player) are enforced only in the client; a tampering client can write anything. **Torchlight**
- **16 kB total**, shared by every extension in the room. Writes over the cap reject. Keep data small, cap list lengths and string lengths, and surface failed writes. **Torchlight**
- `setMetadata` is a shallow merge of top-level keys: `{ [key]: value }` replaces that key's whole value. Two clients writing the same key = last write wins. Use one key per writer when several clients write (Torchlight: one key per player). **Torchlight**
- Your own writes come back to you as change events (echoes). **Torchlight**
- Never write before the first read lands: a default written back wipes the room's real value. **Torchlight** (it happened)
- Deleting a key: believed to be `setMetadata({ [key]: undefined })`. **unverified**
- Change events are believed to arrive in the order the room applied them. Nothing observed contradicted it. **unverified**
- Multi-writer sync is hard. Read `room-sync.md` before having more than one client write the same data.

## Scene, items, players

- Scene APIs (`OBR.scene.items`, scene metadata) only work while a scene is open. Check `OBR.scene.isReady()` and follow `OBR.scene.onReadyChange`; re-run your logic when a scene loads. **Torchlight**
- **Item images can't be SVG.** Chrome can't decode SVG into Owlbear's canvas textures and draws a black square. Use PNG or WebP for anything placed on the map (images, attachments, badges). **verified** (PNG), WebP believed fine (same decoder), pending a live check in Torchlight.
- Render SVG art to PNG with headless Chrome (`scripts/render-png.sh`); ImageMagick drops stroked SVG paths. **verified**
- Batch item changes: one `OBR.scene.items.updateItems(ids, updater)` call instead of one per item. Torchlight cut a sync from eight sequential calls to two. **Torchlight**
- "Can this player edit that token?" Room permissions `CHARACTER_UPDATE` and `CHARACTER_OWNER_ONLY` (then compare `item.createdUserId` to the player id). If the GM's client acts on a player's request, check this and that the item is visible, or a forged request could touch a hidden monster. **Torchlight**
- Context menu `filter.permissions: ["UPDATE"]` uses Owlbear's own notion of "your token" (respects owner-only). **Torchlight**

## Broadcast

- Messages aren't stored: a client that isn't open misses them. Use room metadata for anything that must survive. **Torchlight**
- Pass `destination` explicitly (`"REMOTE"`, `"LOCAL"`, `"ALL"`). Torchlight sends with `"ALL"` so the sender sees its own alert. The default when omitted is decided by Owlbear, not the SDK. **unverified** default
- Everything received is untrusted: parse it like room metadata. **Torchlight**

## Manifest and hosting

- Manifest `name` ≤ 45 chars, `description` ≤ 128, or the install fails (`src/manifest.test.ts`). **Torchlight** (hit it)
- Owlbear fetches the manifest and pages cross-origin. Cloudflare Workers send no CORS header by default: `public/_headers` sets `Access-Control-Allow-Origin: *`. The Vite dev server needs `server.cors: true`. **Torchlight**
- Cloudflare serves `page.html` as a 307 to `/page`. Use extensionless URLs in the manifest (`background_url: "/background"`) and for embeds (`/menu`). **Torchlight**
- Cloudflare preview URLs don't apply the SPA fallback, so deep links 404 on previews (production is fine). Keep the panel on `/` and switch views in-app. **Torchlight**
- `wrangler.jsonc` needs `"previews": {}` or PR preview builds fail. **Torchlight**
- Owlbear caches an installed manifest. After changing the icon or name, remove and re-add the extension to see it. **unverified** (suspected, not observed)
- The toolbar action icon can be SVG; Owlbear's own are white monochrome. The manifest `icon` (extension list) is PNG here; SVG there is **unverified**.

## Browser

- `localStorage` throws inside Owlbear's iframe under strict privacy settings (Safari "Block all cookies", some Firefox modes). An unguarded read during render blanks the panel. Always use `src/storage.ts`. **Torchlight**
- Background tabs throttle timers. For countdowns, store an end time (epoch ms, UTC) and compute remaining time from the clock; never count ticks. **Torchlight**
- Don't hotlink third-party media (upstream hotlinked Giphy); ship assets or use inline SVG. **Torchlight**

## Tooling

- Node pinned to 24 (`.node-version`, `engines`). With Torchlight's set (vitest 4, jsdom 29), Node 25+ broke tests: Node's global `localStorage` shadowed jsdom's. This starter's set (vitest 5, jsdom 30) passed on Node 26.0.0 (2026-10-15), but keep 24 for CI and Workers Builds parity. **verified**
- `@owlbear-rodeo/sdk` 3.1.0 depends on `uuid@^9`, which has a moderate advisory; `package.json` overrides it to `^11.1.1` (the SDK only uses `v4`). Drop the override when the SDK updates. **verified**
- `allowScripts` in `package.json` denies esbuild/workerd/fsevents install scripts; builds work without them. **Torchlight**
- TypeScript stays on 5.x: TS 7 (native rewrite) was too new to trust with Vite tooling at setup time. Revisit. **decision**
- `navigator.clipboard.writeText` inside Owlbear's iframe: **unverified** (may be blocked by the iframe's permissions). Crawl Keeper's Copy button falls back to selecting the text.
- Turn marker (Crawl Keeper): a WebP attachment on the ATTACHMENT layer; that it hides with a hidden parent and that WebP draws (not a black square) are **unverified** until TESTING PR 3 steps 1 and 4 pass.
