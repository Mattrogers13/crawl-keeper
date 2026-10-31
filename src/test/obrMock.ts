// In-memory stand-in for the Owlbear Rodeo SDK, installed for every test by
// setup.ts. Tests drive it through `obr` and the helpers below.
//
// Rules the mock keeps so tests behave like the real SDK:
// - Every SDK call returns a promise (the real ones are messages to the host).
// - setMetadata is a shallow merge of top-level keys, then a change event to
//   every listener, the writer included (Owlbear echoes your own writes).
// - onX() subscriptions return an unsubscribe function.
//
// Only the APIs the starter uses are here. Add what you need, keeping the
// promise shape, and cover it in obrMock.test.ts.

import { vi } from "vitest";
import { act } from "@testing-library/react";
import type { Item, Metadata, Player, Theme } from "@owlbear-rodeo/sdk";

type Listener<T> = (value: T) => void;
type Role = "GM" | "PLAYER";

export const DARK_THEME: Theme = {
  mode: "DARK",
  primary: { light: "#bb99ff", main: "#bb99ff", dark: "#8866cc", contrastText: "#000000" },
  secondary: { light: "#ee99ff", main: "#ee99ff", dark: "#bb66cc", contrastText: "#000000" },
  background: { default: "#1e2231", paper: "#222639" },
  text: { primary: "#ffffff", secondary: "#bbbbbb", disabled: "#777777" },
};

export const LIGHT_THEME: Theme = {
  ...DARK_THEME,
  mode: "LIGHT",
  background: { default: "#f1f3f9", paper: "#ffffff" },
  text: { primary: "#000000", secondary: "#555555", disabled: "#999999" },
};

const fresh = () => ({
  // Owlbear has finished connecting (see becomeReady).
  ready: true,
  readyCallbacks: [] as (() => void)[],
  role: "GM" as Role,
  playerId: "player-1",
  playerName: "Test Player",
  theme: DARK_THEME,
  metadata: {} as Metadata,
  // Every setMetadata rejects while set (e.g. the room's 16 kB cap).
  failWrites: false,
  // While set, a write waits in writeQueue until flushWrite(), which applies
  // it, emits the change and resolves it, in order, like a real round trip.
  deferWrites: false,
  writeQueue: [] as (() => void)[],
  // getRole rejects this many more times (role lookup retry tests).
  failRoleLookups: 0,
  metadataListeners: [] as Listener<Metadata>[],
  playerListeners: [] as Listener<Player>[],
  themeListeners: [] as Listener<Theme>[],
  broadcastListeners: new Map<string, Listener<{ data: unknown; connectionId: string }>[]>(),
  // The open scene (map). Scene metadata and items only work while ready.
  sceneReady: true,
  sceneMetadata: {} as Metadata,
  items: [] as Item[],
  sceneReadyListeners: [] as Listener<boolean>[],
  sceneMetadataListeners: [] as Listener<Metadata>[],
  itemListeners: [] as Listener<Item[]>[],
  // This client's selected item ids.
  selection: [] as string[],
  // Ids handed out by buildImage.
  built: 0,
});

export const obr = fresh();

// Tests that need one-off behavior use vi.spyOn(OBR.room, "getMetadata")
// .mockImplementation(...) etc. resetAllMocks clears calls AND puts each
// vi.fn's own implementation back. (restoreAllMocks does not: spyOn over a
// vi.fn reuses that mock, so there's nothing to restore.) Never assign over
// a mock function: that leaks into every later test.
export const resetObr = () => {
  Object.assign(obr, fresh());
  vi.resetAllMocks();
};

const subscribe = <T>(list: Listener<T>[], cb: Listener<T>) => {
  list.push(cb);
  return () => {
    const i = list.indexOf(cb);
    if (i >= 0) list.splice(i, 1);
  };
};

const applyWrite = (update: Partial<Metadata>) => {
  obr.metadata = { ...obr.metadata, ...update };
  const snapshot = obr.metadata;
  [...obr.metadataListeners].forEach((l) => l(snapshot));
};

const applySceneWrite = (update: Partial<Metadata>) => {
  obr.sceneMetadata = { ...obr.sceneMetadata, ...update };
  const snapshot = obr.sceneMetadata;
  [...obr.sceneMetadataListeners].forEach((l) => l(snapshot));
};

const applyItems = (items: Item[]) => {
  obr.items = items;
  [...obr.itemListeners].forEach((l) => l(items));
};

const needScene = () => {
  if (!obr.sceneReady) throw new Error("No scene open");
};

const playerSnapshot = () => ({ id: obr.playerId, name: obr.playerName, role: obr.role }) as Player;

// --- Helpers for tests ---------------------------------------------------

/** Owlbear finishes connecting (start a test with `obr.ready = false`). */
export const becomeReady = () =>
  act(async () => {
    obr.ready = true;
    obr.readyCallbacks.splice(0).forEach((cb) => cb());
  });

/** Apply the oldest deferred write (see `deferWrites`). */
export const flushWrite = () =>
  act(async () => {
    obr.writeQueue.shift()?.();
  });

/** Another client wrote to the room. */
export const writeFromElsewhere = (update: Partial<Metadata>) =>
  act(async () => {
    applyWrite(update);
  });

/** Another client wrote to the scene's metadata. */
export const writeSceneFromElsewhere = (update: Partial<Metadata>) =>
  act(async () => {
    applySceneWrite(update);
  });

/** A scene opened (true) or closed (false). Opening another map: close, then
 * open with new `sceneMetadata` / `items`. */
export const setSceneReady = (ready: boolean, scene?: { metadata?: Metadata; items?: Item[] }) =>
  act(async () => {
    obr.sceneReady = ready;
    if (scene?.metadata) obr.sceneMetadata = scene.metadata;
    if (scene?.items) obr.items = scene.items;
    [...obr.sceneReadyListeners].forEach((l) => l(ready));
  });

/** The scene's items changed (added, removed, renamed, hidden...). */
export const setItems = (items: Item[]) =>
  act(async () => {
    obr.items = items;
    [...obr.itemListeners].forEach((l) => l(items));
  });

/** A minimal character token for tests. */
export const token = (id: string, extra: Partial<Item> & { url?: string } = {}): Item => {
  const { url, ...rest } = extra;
  return {
    id,
    type: "IMAGE",
    name: id,
    visible: true,
    locked: false,
    createdUserId: "player-1",
    zIndex: 0,
    lastModified: "",
    lastModifiedUserId: "",
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    layer: "CHARACTER",
    metadata: {},
    image: { url: url ?? `https://example.com/${id}.png`, width: 100, height: 100, mime: "image/png" },
    grid: { dpi: 100, offset: { x: 50, y: 50 } },
    ...rest,
  } as Item;
};

/** The player changed (role switch, rename). */
export const changePlayer = (change: { role?: Role; name?: string }) =>
  act(async () => {
    if (change.role) obr.role = change.role;
    if (change.name) obr.playerName = change.name;
    [...obr.playerListeners].forEach((l) => l(playerSnapshot()));
  });

/** Owlbear's theme changed. */
export const changeTheme = (theme: Theme) =>
  act(async () => {
    obr.theme = theme;
    [...obr.themeListeners].forEach((l) => l(theme));
  });

/** A broadcast arrived from another client. */
export const receiveBroadcast = (channel: string, data: unknown) =>
  act(async () => {
    (obr.broadcastListeners.get(channel) ?? []).forEach((l) => l({ data, connectionId: "other" }));
  });

// --- The mocked SDK ------------------------------------------------------

/** buildImage: a chainable builder that records what it was given. */
export const buildImage = (image: Record<string, unknown>, grid: Record<string, unknown>) => {
  const item: Record<string, unknown> = {
    id: `built-${++obr.built}`,
    type: "IMAGE",
    image,
    grid,
    visible: true,
    metadata: {},
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    disableAttachmentBehavior: [],
  };
  const builder = {
    build: () => item as unknown as Item,
  } as Record<string, unknown>;
  for (const key of ["name", "position", "attachedTo", "visible", "layer", "locked", "disableHit", "disableAttachmentBehavior", "metadata"]) {
    builder[key] = (value: unknown) => {
      item[key] = value;
      return builder;
    };
  }
  return builder as { build: () => Item } & Record<string, (v: unknown) => typeof builder>;
};

export const OBR = {
  isAvailable: true,
  get isReady() {
    return obr.ready;
  },
  // The real onReady calls back at once when already ready.
  onReady: vi.fn((cb: () => void) => {
    if (obr.ready) cb();
    else obr.readyCallbacks.push(cb);
  }),
  room: {
    id: "room-1",
    getMetadata: vi.fn(async () => obr.metadata),
    setMetadata: vi.fn(async (update: Partial<Metadata>) => {
      if (obr.failWrites) throw new Error("Metadata too large");
      if (!obr.deferWrites) return applyWrite(update);
      return new Promise<void>((resolve) =>
        obr.writeQueue.push(() => {
          applyWrite(update);
          resolve();
        }),
      );
    }),
    onMetadataChange: vi.fn((cb: Listener<Metadata>) => subscribe(obr.metadataListeners, cb)),
  },
  player: {
    get id() {
      return obr.playerId;
    },
    getId: vi.fn(async () => obr.playerId),
    getName: vi.fn(async () => obr.playerName),
    getRole: vi.fn(async () => {
      if (obr.failRoleLookups > 0) {
        obr.failRoleLookups--;
        throw new Error("Not connected");
      }
      return obr.role;
    }),
    onChange: vi.fn((cb: Listener<Player>) => subscribe(obr.playerListeners, cb)),
    select: vi.fn(async (ids: string[], replace?: boolean) => {
      obr.selection = replace ? [...ids] : [...new Set([...obr.selection, ...ids])];
    }),
  },
  scene: {
    // A 5 ft grid at 150 dpi, Owlbear's default.
    grid: {
      getDpi: vi.fn(async () => 150),
      getScale: vi.fn(async () => ({ raw: "5ft", parsed: { multiplier: 5, unit: "ft", digits: 0 } })),
    },
    isReady: vi.fn(async () => obr.sceneReady),
    onReadyChange: vi.fn((cb: Listener<boolean>) => subscribe(obr.sceneReadyListeners, cb)),
    getMetadata: vi.fn(async () => {
      needScene();
      return obr.sceneMetadata;
    }),
    setMetadata: vi.fn(async (update: Partial<Metadata>) => {
      needScene();
      if (obr.failWrites) throw new Error("Metadata too large");
      applySceneWrite(update);
    }),
    onMetadataChange: vi.fn((cb: Listener<Metadata>) => subscribe(obr.sceneMetadataListeners, cb)),
    items: {
      getItems: vi.fn(async (filter?: string[] | ((item: Item) => boolean)) => {
        needScene();
        if (!filter) return obr.items;
        return obr.items.filter((i) => (typeof filter === "function" ? filter(i) : filter.includes(i.id)));
      }),
      // Like Owlbear: the change reaches every items.onChange listener.
      addItems: vi.fn(async (items: Item[]) => {
        needScene();
        applyItems([...obr.items, ...items]);
      }),
      // Like Owlbear's (an immer draft): the updater edits copies of the items.
      updateItems: vi.fn(async (ids: string[], update: (drafts: Item[]) => void) => {
        needScene();
        const drafts = obr.items.filter((i) => ids.includes(i.id)).map((i) => structuredClone(i));
        update(drafts);
        const byId = new Map(drafts.map((d) => [d.id, d]));
        applyItems(obr.items.map((i) => byId.get(i.id) ?? i));
      }),
      deleteItems: vi.fn(async (ids: string[]) => {
        needScene();
        // Attachments go with their parent (default DELETE behaviour).
        const gone = new Set(ids);
        let grew = true;
        while (grew) {
          grew = false;
          for (const i of obr.items) {
            if (!gone.has(i.id) && i.attachedTo && gone.has(i.attachedTo)) {
              gone.add(i.id);
              grew = true;
            }
          }
        }
        applyItems(obr.items.filter((i) => !gone.has(i.id)));
      }),
      onChange: vi.fn((cb: Listener<Item[]>) => subscribe(obr.itemListeners, cb)),
      // A 100-unit box around the items' positions.
      getItemBounds: vi.fn(async (ids: string[]) => {
        needScene();
        const p = obr.items.find((i) => ids.includes(i.id))?.position ?? { x: 0, y: 0 };
        return { min: { x: p.x - 50, y: p.y - 50 }, max: { x: p.x + 50, y: p.y + 50 }, width: 100, height: 100, center: p };
      }),
    },
  },
  // An 800 x 600 view at zoom 2. Records only.
  viewport: {
    getScale: vi.fn(async () => 2),
    getWidth: vi.fn(async () => 800),
    getHeight: vi.fn(async () => 600),
    animateTo: vi.fn(async () => undefined),
  },
  action: {
    setHeight: vi.fn(async () => undefined),
  },
  contextMenu: {
    create: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
  theme: {
    getTheme: vi.fn(async () => obr.theme),
    onChange: vi.fn((cb: Listener<Theme>) => subscribe(obr.themeListeners, cb)),
  },
  notification: {
    show: vi.fn(async () => "notification-id"),
  },
  broadcast: {
    // Records only. Simulate incoming messages with receiveBroadcast().
    sendMessage: vi.fn(async () => undefined),
    onMessage: vi.fn((channel: string, cb: Listener<{ data: unknown; connectionId: string }>) => {
      const list = obr.broadcastListeners.get(channel) ?? [];
      obr.broadcastListeners.set(channel, list);
      return subscribe(list, cb);
    }),
  },
};
