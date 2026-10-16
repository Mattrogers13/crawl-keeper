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
import type { Metadata, Player, Theme } from "@owlbear-rodeo/sdk";

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
