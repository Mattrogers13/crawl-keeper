// The death timer's events (p. 89; docs/effects.md step 5): the GM's panel
// sends one when a character starts dying, rolls the death d20, rises, is
// stabilized or healed, or dies. Every client's background page shows it and
// writes it to its session log, so players hear the rolls with or without
// Dice+. Like Time passes, a structured message (no free text but the
// token's name), parsed as untrusted.
import OBR from "@owlbear-rodeo/sdk";

import { ID, SETTINGS_KEY } from "./constants";
import { parseSettings } from "./settings";
import { logEvent } from "./sessionLog";
import { errorMessage } from "./utils";

export const DYING_CHANNEL = `${ID}/dying`;

export type DeathEvent =
  | { event: "started"; name: string; rounds: number; d4: number | null; con: number | null }
  | { event: "rolled"; name: string; value: number }
  | { event: "rises" | "stabilized" | "healed" | "died"; name: string };

const NAME_MAX = 64;
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export const parseDeathEvent = (raw: unknown): DeathEvent | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return null;
  switch (r.event) {
    case "started": {
      const rounds = int(r.rounds, 1, 99);
      return rounds === null ? null : { event: "started", name, rounds, d4: int(r.d4, 1, 4), con: int(r.con, -4, 4) };
    }
    case "rolled": {
      const value = int(r.value, 1, 20);
      return value === null ? null : { event: "rolled", name, value };
    }
    case "rises":
    case "stabilized":
    case "healed":
    case "died":
      return { event: r.event, name };
    default:
      return null;
  }
};

const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);

export const deathMessage = (e: DeathEvent): string => {
  switch (e.event) {
    case "started": {
      const how = e.d4 !== null && e.con !== null ? ` (d4 ${e.d4} ${signed(e.con)} CON)` : "";
      return `${e.name} is dying: dies in ${e.rounds} round${e.rounds === 1 ? "" : "s"}${how}.`;
    }
    case "rolled":
      return e.value === 20 ? `${e.name} rolls a natural 20 on the death d20!` : `${e.name} rolls ${e.value} on the death d20.`;
    case "rises":
      return `${e.name} rises with 1 HP.`;
    case "stabilized":
      return `${e.name} is stabilized: no longer dying, still unconscious.`;
    case "healed":
      return `${e.name} is healed and no longer dying.`;
    case "died":
      return `${e.name} died.`;
  }
};

// The GM's panel, after the change is saved: to everyone, or (Settings →
// Show the death timer to players off) to the GM's own client only.
export const sayDeath = async (e: DeathEvent) => {
  try {
    const show = parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]).showDeath;
    await OBR.broadcast.sendMessage(DYING_CHANNEL, e, { destination: show ? "ALL" : "LOCAL" });
  } catch (err) {
    console.warn(`Couldn't send the death event: ${errorMessage(err)}`);
  }
};

// Every client's background page.
export const watchDeathNotices = () =>
  OBR.broadcast.onMessage(DYING_CHANNEL, ({ data }) => {
    const e = parseDeathEvent(data);
    if (!e) return;
    const text = deathMessage(e);
    logEvent(text, "effect");
    OBR.notification.show(text, e.event === "died" || (e.event === "rolled" && e.value === 20) ? "WARNING" : "INFO").catch(() => {});
  });
