// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

import type { EncounterMode } from "./crawl";

export type Settings = {
  // Standard 1-in-6 checks, or the Crawling Clock instead.
  encounterMode: EncounterMode;
  // Players don't see the Crawling Clock.
  hideClock: boolean;
  // Players see the map's danger level (the book treats it as GM-only).
  showDanger: boolean;
  // ▶ onto the GM turn rolls a due check / crawling die by itself.
  autoRoll: boolean;
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
  encounterMode: "standard",
  hideClock: false,
  showDanger: false,
  autoRoll: false,
  hideRound: false,
  clearRollsOnCombat: true,
  showMarker: true,
  selectOnTurn: true,
};

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    encounterMode: r.encounterMode === "clock" ? "clock" : "standard",
    hideClock: r.hideClock === true,
    showDanger: r.showDanger === true,
    autoRoll: r.autoRoll === true,
    hideRound: r.hideRound === true,
    clearRollsOnCombat: r.clearRollsOnCombat !== false,
    showMarker: r.showMarker !== false,
    selectOnTurn: r.selectOnTurn !== false,
  };
};
