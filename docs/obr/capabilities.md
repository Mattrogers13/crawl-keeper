# Brief → components

For Claude: how answers in `BRIEF.md` map to SDK APIs, starter patterns and gotchas. API names are from SDK 3.1.0 source (`sources/sdk/src/index.ts` and `api/`); read the source for signatures. "Starter" = already in the template. "Pattern" = documented in `patterns.md`. "New" = nobody here has built it yet; read the SDK source and the tutorials, and expect to verify in a real room.

## After reading the brief

1. Ask follow-ups one at a time, starting with anything flagged ⚠️, any "not sure", and answers that conflict (e.g. "players change it" + "hidden from players").
2. Propose the component list (table below), the data layout (which keys, who writes each, size estimate vs 16 kB) and v0.1 scope. Wait for approval before building.
3. Record the agreed design in CLAUDE.md (overview + any new rules) and remove the example note feature.

## Section 2: where it shows up

| Answer | API | Status |
|---|---|---|
| Toolbar button + panel | manifest `action` (`popover: "/"`), `OBR.action` (open/close, size, title, icon) | Starter |
| Badge on the toolbar button | `OBR.action.setBadgeText`, `setBadgeBackgroundColor` | New |
| Right-click on items | `OBR.contextMenu.create` from a background page; `filter` by layer/permissions; `embed` for a submenu | Pattern |
| New left-toolbar tool with modes | `OBR.tool.create`, `createMode` (pointer events on the map), `createAction`, `activateTool` | New: read `sources/sdk-tutorials/custom-tool` |
| Large window over the map | `OBR.modal.open({ id, url, width, height })` (separate page, add to Vite `input`) | New |
| Extra popovers | `OBR.popover.open` | New |
| Draws on the map | see section 3 | |
| Background only | `background_url` page | Pattern |

## Section 3: what it does to the map

| Answer | API | Status / gotchas |
|---|---|---|
| Read tokens | `OBR.scene.items.getItems(filter)`, `onChange`; needs `OBR.scene.isReady` | Pattern. Re-run on scene load |
| Change tokens | `OBR.scene.items.updateItems(ids, draft => …)` (immer-style draft) | Pattern. Batch; players may lack permission (`OBR.player.hasPermission`, room permissions) |
| Use the selection | `OBR.player.getSelection`, `select`, `deselect` | Torchlight `menu.ts` |
| Images on the map | `buildImage(content, grid)`; `buildBillboard` (keeps screen size) | Pattern. Never SVG (black square) |
| Shapes / lines / drawings | `buildShape`, `buildLine`, `buildCurve`, `buildPath` | New |
| Text / labels | `buildText`, `buildLabel` | New |
| Badges on tokens | `buildImage(...).attachedTo(id).layer("ATTACHMENT")` | Pattern (Torchlight `tokenSync.ts`) |
| Fog | `OBR.scene.fog` (color, stroke, filled) | New |
| Lights / walls | `buildLight`, `buildWall` (FOG layer items), or Dynamic Fog's metadata (`rodeo.owlbear.dynamic-fog/light`) | New / Pattern. Native items: rendering and whether Dynamic Fog is required are **unverified** |
| Effects | `buildEffect` | New, unverified |
| Distance / grid | `OBR.scene.grid` (`getDpi`, `getScale`, `getDistance`, `snapPosition`) | Torchlight converts feet → pixels via grid scale |
| Camera | `OBR.viewport` (`animateTo`, `animateToBounds`, `transformPoint`) | New |
| Undo | `OBR.scene.history` (`undo`, `redo`, `canUndo`); whether item updates join history automatically is **unverified** | New |
| Only I see it | `OBR.scene.local` (same item API, not shared) | New |
| Smooth dragging | `OBR.interaction.startItemInteraction` | New |
| Rulers / pointers | `buildRuler`, `buildPointer` | New |

## Section 4: who sees and changes what

| Answer | Approach |
|---|---|
| GM-only info | Render only when `useRole() === "GM"`. It's still readable by players if stored in shared metadata: say so. |
| Players see / change it | Shared metadata. Players changing it → one key per player (`room-sync.md`) |
| Hidden from players | Not possible in shared state without a server. Options: keep it local to the GM (localStorage / `OBR.scene.local`), accept "hidden from the UI only", or add a server (out of starter scope) |
| Only their own tokens | Permission check like Torchlight's `playerMayLight` (`CHARACTER_UPDATE`, `CHARACTER_OWNER_ONLY` → `createdUserId`); context menu `permissions: ["UPDATE"]` |
| List of players | `OBR.party.getPlayers`, `OBR.party.onChange` | 

## Section 5: where the data lives

| Answer | API | Notes |
|---|---|---|
| Room | `OBR.room.getMetadata` / `setMetadata` / `onMetadataChange` | Starter (`useRoomValue`). 16 kB total across extensions |
| Scene / map | `OBR.scene.getMetadata` / `setMetadata` / `onMetadataChange` | New. Only while a scene is open. Size limit **unverified** |
| Per token | `item.metadata[`${ID}/…`]` via `updateItems` | Pattern. Travels with the token |
| Per player | `OBR.player.setMetadata` (visible to others via `OBR.party`), or a room key per player | Torchlight used room keys. Whether player metadata persists after leaving is **unverified** |
| My computer only | `src/storage.ts` | Starter |
| Uploads (asset picker) | `OBR.assets.downloadImages` (lets the user pick from their uploads), `uploadImages` | New |

## Section 6: timing

| Answer | Approach |
|---|---|
| Instant updates | `onMetadataChange` / `onChange` subscriptions (starter does this) |
| Alerts / pings | `OBR.broadcast` + `notify()` | Pattern |
| Timers | Store end time (epoch ms UTC), compute from the clock | Torchlight `lights.ts` |
| Panel closed | Background page | Pattern |
| React to map/token changes | `OBR.scene.onReadyChange`, `OBR.scene.items.onChange` in the background page | Pattern |

## Section 7: outside connections

| Answer | Notes |
|---|---|
| Another extension | Read/write its metadata keys; parse defensively; it may not be installed. GPL sources: read, don't copy |
| Import/export | JSON download/upload in the panel; validate every import like room data |
| Outside API | Needs CORS from that API; keys are visible to every user. Flag before building |

## Section 8: look

Starter matches Owlbear's theme (`--obr-*` CSS vars → `bg-obr-*` Tailwind classes). Icons: toolbar = white monochrome SVG; manifest = PNG (`scripts/render-png.sh`); anything on the map = PNG/WebP.
