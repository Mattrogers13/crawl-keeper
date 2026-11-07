// Dev builds only: a debug log the GM can copy from Settings → Room check
// (Matt, 2026-11-07: a stuck Party / Split switch with nothing in the
// browser console, because Crawl Keeper's frame logs separately). The panel
// and the background page both write it (same origin: localStorage); the last
// 300 lines are kept. Live builds log nothing.
import { ID } from "./constants";
import { readLocal, writeLocal } from "./storage";

const KEY = `${ID}/debug-log`;
const MAX = 300;
export const debugOn = !!import.meta.env.VITE_BUILD_LABEL;

const safe = (data: unknown) => {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

export const readDebug = (): string[] => {
  try {
    const raw = JSON.parse(readLocal(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((l): l is string => typeof l === "string") : [];
  } catch {
    return [];
  }
};

export const clearDebug = () => writeLocal(KEY, "[]");

export const debug = (where: string, message: string, data?: unknown) => {
  if (!debugOn) return;
  const line = `${new Date().toISOString().slice(11, 23)} ${where}: ${message}${data === undefined ? "" : ` ${safe(data)}`}`;
  console.info("[crawl-keeper]", line);
  writeLocal(KEY, JSON.stringify([...readDebug(), line].slice(-MAX)));
};
