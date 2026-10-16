// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

export type Settings = {
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
  hideRound: false,
  clearRollsOnCombat: true,
  showMarker: true,
  selectOnTurn: true,
};

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    hideRound: r.hideRound === true,
    clearRollsOnCombat: r.clearRollsOnCombat !== false,
    showMarker: r.showMarker !== false,
    selectOnTurn: r.selectOnTurn !== false,
  };
};
