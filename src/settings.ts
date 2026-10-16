// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

export type Settings = {
  hideRound: boolean;
};

export const DEFAULT_SETTINGS: Settings = { hideRound: false };

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    hideRound: r.hideRound === true,
  };
};
