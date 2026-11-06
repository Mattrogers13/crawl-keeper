// The session log (Matt, 2026-11-06; like Shadow Sheet's roll history): every
// notice this client shows (lights burning out, Time passes, effects ending,
// combat, a focus lost) is also written here, newest first, so the tracker
// can let them go. Per browser and per room, in localStorage (Matt chose
// this over scene or room metadata: no shared budget, any length); each
// client keeps its own, as it shows its own notices. Times are UTC ms,
// shown local.
import OBR from "@owlbear-rodeo/sdk";

import { ID } from "./constants";
import { readLocal, writeLocal } from "./storage";

export type LogKind = "light" | "time" | "effect" | "combat" | "focus" | "session";
export type LogEntry = { at: number; text: string; kind: LogKind };

export const LOG_MAX = 500;
const TEXT_MAX = 300;
const KINDS: LogKind[] = ["light", "time", "effect", "combat", "focus", "session"];

const key = () => `${ID}/log/${OBR.room.id}`;

// Same-document listeners (the storage event only reaches other documents:
// the background page writes, the panel shows).
const listeners = new Set<() => void>();

// Untrusted (storage another version of us, or anything, may have written).
export const parseLog = (raw: string | null): LogEntry[] => {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .flatMap((e): LogEntry[] => {
        const { at, text, kind } = (e ?? {}) as Record<string, unknown>;
        if (typeof at !== "number" || !Number.isFinite(at) || typeof text !== "string" || !text.trim()) return [];
        return [{ at, text: text.slice(0, TEXT_MAX), kind: KINDS.includes(kind as LogKind) ? (kind as LogKind) : "effect" }];
      })
      .slice(0, LOG_MAX);
  } catch {
    return [];
  }
};

export const readLog = () => parseLog(readLocal(key()));

const save = (entries: LogEntry[]) => {
  writeLocal(key(), JSON.stringify(entries));
  listeners.forEach((l) => l());
};

export const logEvent = (text: string, kind: LogKind, at = Date.now()) => {
  if (!text.trim()) return;
  save([{ at, text: text.slice(0, TEXT_MAX), kind }, ...readLog()].slice(0, LOG_MAX));
};

export const clearLog = () => save([]);

// Any change, from this page or another. Returns the unsubscribe.
export const onLogChange = (listener: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === key()) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

// The log as text, oldest first (Download).
export const logText = (entries: LogEntry[]) =>
  [...entries]
    .reverse()
    .map((e) => `${new Date(e.at).toLocaleString()}  ${e.text}`)
    .join("\n");
