# Patterns: adding Owlbear features

Not shipped in the starter (most extensions don't need all of them). Each was built and used in Torchlight; its repo (github.com/Mattrogers13/obr-torchlight) has the full code. SDK reference: `sources/sdk/src/api/`.

## Background page (runs while the extension is enabled, panel open or not)

Use for anything that must work with the panel closed: context menus, reacting to scene changes, timers.

1. `background.html` at the repo root with `<script type="module" src="/src/background.ts"></script>`.
2. Add it to `build.rollupOptions.input` in `vite.config.ts` (otherwise Vite doesn't build it).
3. Manifest: `"background_url": "/background"` (extensionless, see gotchas).
4. `src/background.ts`: wrap everything in `OBR.onReady(...)`. Keep it free of React imports; share constants via `src/constants.ts`.
5. Every client with the extension enabled runs it. If only one client should act (e.g. update items), gate on role (GM) and re-check when the role changes (`OBR.player.onChange`).

Torchlight: `src/background.ts`.

## Context menu (right-click on items)

- `OBR.contextMenu.create({ id, icons: [{ icon, label, filter }], onClick | embed })` from the background page.
- `filter: { every: [{ key: "layer", value: "CHARACTER" }], permissions: ["UPDATE"] }` = character tokens this player may edit.
- `create` / `remove` can fail: track what Owlbear actually has, retry with back-off, and collapse overlapping syncs into one rerun.
- For a submenu, use `embed: { url: "/menu", height }` with a separate small page (plain DOM, no React, so it opens instantly; also add it to Vite's `input`). Style it from `OBR.theme.getTheme()`.

Torchlight: `src/background.ts` (menu), `menu.html` + `src/menu.ts` (embedded submenu).

## Token attachments (badges, markers)

```ts
buildImage(
  { width: 128, height: 128, mime: "image/webp", url: `${location.origin}/img/badge.webp` },
  { dpi: 128 / 0.35, offset: { x: 64, y: 64 } }, // about a third of a grid cell
)
  .attachedTo(token.id)
  .layer("ATTACHMENT")
  .locked(true)
  .disableHit(true)
  .disableAttachmentBehavior(["ROTATION", "COPY"])
  .metadata({ [`${ID}/badge`]: { ... } }) // so you can find your own items later
  .build();
```

- Images must be PNG/WebP, never SVG (black square). Keep `mime` in step with the file type.
- Find your items by your metadata key, and replace ones whose image URL is stale (lets you change the art later).
- Decide what to do in a pure function (`plan(items, state) → { add, update, delete }`), unit-test that, and keep the SDK calls thin. Batch: one `addItems`, one `updateItems`, one `deleteItems`.

Torchlight: `src/tokenSync.ts` (`planSync` is the pure part).

## Working with another extension's data (e.g. Dynamic Fog)

Extensions store per-item data under their own metadata key. Dynamic Fog's token light is `rodeo.owlbear.dynamic-fog/light`. You can set it to give a token light, but: save the token's previous value under your own key and restore it later, parse what you read (reduce it to known fields), and remember the other extension may not be installed. Dynamic Fog is GPL-3.0: read its source for the format, don't copy code.

## Broadcast (one-off events: alerts, pings)

```ts
const CHANNEL = `${ID}/event`;
OBR.broadcast.sendMessage(CHANNEL, payload, { destination: "ALL" });
const off = OBR.broadcast.onMessage(CHANNEL, ({ data }) => handle(parse(data)));
```

Not stored; parse `data`. If the event must reach clients that open later, also record it in room metadata.

## Per-player data

Use one key per player (`${ID}/player/<playerId>`) so players never write the same key. Parse the whole set with one function that drops malformed ids/docs. See `room-sync.md`.

## Notifications

`notify()` in `src/utils.ts` wraps `OBR.notification.show` so a failure can't become an unhandled rejection.

## "What's new" modal

Store the last-seen version in localStorage (through `storage.ts`) and show release highlights when the build's `VERSION` differs (any change, not just newer). Keep the notes in a `releaseNotes.ts` list and a human `RELEASE-NOTES.md`.

Torchlight: `src/components/WhatsNew.tsx`.

## Routing (multiple tabs in the panel)

Add `react-router-dom` only if you need it. Keep the popover on `/` and switch views in-app: Cloudflare previews 404 on deep links.

## Dev build label

Already wired: non-main Cloudflare builds rename the manifest to "(Dev)" and show `DEV · <branch> · <sha>` in the panel footer. Confirm a deploy with `curl -s https://<dev-url>/ | grep -o '/assets/main-[^"]*\.js'`, then grep that file for the sha.
