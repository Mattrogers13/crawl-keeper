import { useCallback, useEffect, useRef, useState } from "react";
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";

import { errorMessage, notify } from "../utils";

const FIRST_RETRY_MS = 2000;
const MAX_RETRY_MS = 30_000;

// One value stored under one room metadata key, shared by everyone in the room.
//
// Built for ONE WRITER per key (e.g. only the GM writes it, everyone reads).
// With several clients writing the same key, each write replaces the whole
// value (last write wins) and an in-flight write can be briefly overwritten
// by an older echo. Read docs/obr/room-sync.md before going there.
//
// Rules it keeps:
// - Everything read from the room goes through `parse`: any client or
//   extension can write any key, so treat the raw value as untrusted.
// - `loaded` is false until the first read lands, and `write` refuses until
//   then. Writing a default before the read would wipe the room's real value.
// - A failed write tells the user and re-reads the room, so the optimistic
//   local value doesn't silently stick.
export const useRoomValue = <T>(key: string, parse: (raw: unknown) => T) => {
  // State remembers which key it belongs to, so a new key reads as unloaded
  // on the very render it changes (before the effect below re-reads).
  const [state, setState] = useState(() => ({ key, loaded: false, value: parse(undefined) }));
  // The last value taken for this key, serialized; null = not read yet.
  // (A missing key serializes as "undefined", so it can't be confused with
  // "not read yet".)
  const lastRaw = useRef<string | null>(null);
  const loaded = useRef(false);
  const parseRef = useRef(parse);
  parseRef.current = parse;
  // The key this hook is on now. A read or re-read started for an earlier
  // key can land late; it must not mark the new key as loaded.
  const keyRef = useRef(key);
  keyRef.current = key;

  // Take the room's value for `key`. Other keys changing (including other
  // extensions' writes) don't re-render.
  const take = useCallback(
    (metadata: Metadata) => {
      if (key !== keyRef.current) return;
      const raw = JSON.stringify(metadata[key]) ?? "undefined";
      const wasLoaded = loaded.current;
      loaded.current = true;
      if (raw === lastRaw.current) {
        // Don't even call setState when nothing changed: an updater that
        // returns the same state can still re-render the component.
        if (!wasLoaded) setState((s) => ({ ...s, key, loaded: true }));
        return;
      }
      lastRaw.current = raw;
      setState({ key, loaded: true, value: parseRef.current(metadata[key]) });
    },
    [key],
  );

  useEffect(() => {
    // New key: nothing is known about it until its first read lands.
    loaded.current = false;
    lastRaw.current = null;
    let alive = true;
    // An event is newer than the initial read's answer.
    let fromEvent = false;
    // Until a read lands nothing can be saved, so a failed read retries
    // (backing off) and reports once.
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait = FIRST_RETRY_MS;
    let reported = false;
    const read = () =>
      OBR.room
        .getMetadata()
        .then((m) => alive && !fromEvent && take(m))
        .catch((err) => {
          if (!alive || fromEvent) return;
          if (!reported) notify(`Couldn't read the room, retrying: ${errorMessage(err)}`, "ERROR");
          reported = true;
          retry = setTimeout(read, wait);
          wait = Math.min(wait * 2, MAX_RETRY_MS);
        });
    read();
    const off = OBR.room.onMetadataChange((m) => {
      fromEvent = true;
      take(m);
    });
    return () => {
      alive = false;
      clearTimeout(retry);
      off();
    };
  }, [take]);

  const write = useCallback(
    async (value: T): Promise<boolean> => {
      if (!loaded.current) return false;
      lastRaw.current = JSON.stringify(value) ?? "undefined";
      setState({ key, loaded: true, value });
      try {
        await OBR.room.setMetadata({ [key]: value });
        return true;
      } catch (err) {
        notify(`Couldn't save: ${errorMessage(err)}`, "ERROR");
        lastRaw.current = null;
        await OBR.room
          .getMetadata()
          .then(take)
          .catch(() => {});
        return false;
      }
    },
    [key, take],
  );

  const current = state.key === key ? state : { key, loaded: false, value: parse(undefined) };
  return { loaded: current.loaded, value: current.value, write };
};
