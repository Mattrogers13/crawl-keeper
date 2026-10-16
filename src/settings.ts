// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

import type { OrderMode } from "./tracker";

export type Settings = {
  orderMode: OrderMode;
  hideRound: boolean;
};

export const DEFAULT_SETTINGS: Settings = { orderMode: "d20", hideRound: false };

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    orderMode: r.orderMode === "table" ? "table" : "d20",
    hideRound: r.hideRound === true,
  };
};
