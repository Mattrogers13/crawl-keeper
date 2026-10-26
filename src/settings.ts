// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

import type { ClockDice, EncounterMode } from "./crawl";

export type Settings = {
  // Crawl Keeper rolls encounters; off, the GM rolls at the table and the
  // card only says when a check is due (encounterMode is kept for later).
  encounterRolls: boolean;
  // Standard 1-in-6 checks, or the Crawling Clock instead.
  encounterMode: "standard" | "clock";
  // The Crawling Clock's size: 1d20, or 2d20 run down one die at a time.
  clockDice: ClockDice;
  // Players don't see the Crawling Clock.
  hideClock: boolean;
  // Players see the map's danger level (the book treats it as GM-only).
  showDanger: boolean;
  // ▶ onto the GM turn rolls a due check / crawling die by itself.
  autoRoll: boolean;
  // Players see the last encounter check or crawling die roll.
  showRolls: boolean;
  // Torchlight's lights drive darkness: all out = dark, Deadly, and a dim
  // light on the party's tokens; a light back undoes it.
  followTorchlight: boolean;
  // Hide the round counts from players.
  hideRound: boolean;
  // Switching to combat clears the rolls for the combat roll.
  clearRollsOnCombat: boolean;
  // A ring on the current token on the map (follows the token's visibility).
  showMarker: boolean;
  // Select the current token on the GM's screen on each turn (tokens whose
  // turn marker is on; see Entry.marker).
  selectOnTurn: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  encounterRolls: true,
  encounterMode: "standard",
  clockDice: 1,
  hideClock: false,
  showDanger: false,
  autoRoll: false,
  showRolls: false,
  followTorchlight: true,
  hideRound: false,
  clearRollsOnCombat: true,
  showMarker: true,
  selectOnTurn: true,
};

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    encounterRolls: r.encounterRolls !== false,
    encounterMode: r.encounterMode === "clock" ? "clock" : "standard",
    clockDice: r.clockDice === 2 ? 2 : 1,
    hideClock: r.hideClock === true,
    showDanger: r.showDanger === true,
    autoRoll: r.autoRoll === true,
    showRolls: r.showRolls === true,
    followTorchlight: r.followTorchlight !== false,
    hideRound: r.hideRound === true,
    clearRollsOnCombat: r.clearRollsOnCombat !== false,
    showMarker: r.showMarker !== false,
    selectOnTurn: r.selectOnTurn !== false,
  };
};

// The mode the panel runs: the chosen one, or manual with encounter rolls off.
export const effectiveMode = (s: Settings): EncounterMode => (s.encounterRolls ? s.encounterMode : "manual");
