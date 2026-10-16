// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

export type Settings = {
  // Hide the round counts from players.
  hideRound: boolean;
  // Switching to combat clears the rolls for the combat roll.
  clearRollsOnCombat: boolean;
  // A ring on the current token on the map (follows the token's visibility).
  showMarker: boolean;
  // Select the current token on the GM's screen on each turn.
  selectOnTurn: boolean;
  // The marker and selection also go to monsters on their combat turns
  // (otherwise players' tokens only).
  markMonsters: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  hideRound: false,
  clearRollsOnCombat: true,
  showMarker: true,
  selectOnTurn: true,
  markMonsters: false,
};

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    hideRound: r.hideRound === true,
    clearRollsOnCombat: r.clearRollsOnCombat !== false,
    showMarker: r.showMarker !== false,
    selectOnTurn: r.selectOnTurn !== false,
    markMonsters: r.markMonsters === true,
  };
};
