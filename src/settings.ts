// GM settings, one room metadata key (they follow the party across maps).
// Later PRs add fields; parse keeps unknown or malformed fields at defaults.

import type { ClockDice, EncounterMode } from "./crawl";
import { intIn } from "./parse";

export type Settings = {
  // Crawl Keeper rolls encounters; off, the GM rolls at the table and the
  // card only says when a check is due (encounterMode is kept for later).
  encounterRolls: boolean;
  // Standard 1-in-6 checks, or the Crawling Clock instead.
  encounterMode: "standard" | "clock";
  // The Crawling Clock's size: 1d20, or 2d20 run down one die at a time.
  clockDice: ClockDice;
  // Players see the Crawling Clock. (Older rooms saved hideClock; parseSettings reads it.)
  showClock: boolean;
  // Players see the map's danger level (the book treats it as GM-only).
  showDanger: boolean;
  // ▶ onto the GM turn rolls a due check / crawling die by itself.
  autoRoll: boolean;
  // Players see the last encounter check or crawling die roll.
  showRolls: boolean;
  // The Light Tracker drives darkness: with lights tracked and none shining
  // it's total darkness (isDark in lights.ts); off, or with no lights, the
  // map's own Darkness switch decides.
  followLight: boolean;
  // Players see the round counts. (Older rooms saved hideRound.)
  showRound: boolean;
  // Switching to combat clears the rolls for the combat roll.
  clearRollsOnCombat: boolean;
  // A ring on the current token on the map (follows the token's visibility).
  showMarker: boolean;
  // Select the current token on the GM's screen on each turn (tokens whose
  // turn marker is on; see Entry.marker).
  selectOnTurn: boolean;
  // Players see the lights: the darkness card, the row badges and DIS tags.
  // Off, they see only their own lights.
  showLights: boolean;
  // Effect icons on the tokens (src/effectIcons.ts); off for tables that
  // already use a condition marker extension.
  effectIcons: boolean;
  // Players light and put out lights on their own tokens (asked of the
  // GM's client, which checks this: playerLights.ts). Off like Torchlight's.
  playersLight: boolean;
  // Roll through the Dice+ extension when it's installed (src/diceRoller.ts).
  dicePlus: boolean;
  // Players see the death timer: the Dying line and icon, its notices and
  // the death rolls (p. 89 has it in the open). Off: the GM's alone.
  showDeath: boolean;
  // Manual rolls: the card pulses on the GM's turn every this many crawl
  // rounds, a reminder to roll (1 to 10; default 3, Unsafe's cadence).
  remindEvery: number;
};

export const REMIND_MAX = 10;

export const DEFAULT_SETTINGS: Settings = {
  encounterRolls: true,
  encounterMode: "standard",
  clockDice: 1,
  showClock: true,
  showDanger: false,
  autoRoll: false,
  showRolls: false,
  followLight: true,
  showRound: true,
  clearRollsOnCombat: true,
  showMarker: true,
  selectOnTurn: true,
  showLights: true,
  playersLight: false,
  effectIcons: true,
  dicePlus: true,
  showDeath: true,
  remindEvery: 3,
};

export const parseSettings = (raw: unknown): Settings => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    encounterRolls: r.encounterRolls !== false,
    encounterMode: r.encounterMode === "clock" ? "clock" : "standard",
    clockDice: r.clockDice === 2 ? 2 : 1,
    showClock: r.showClock !== undefined ? r.showClock !== false : r.hideClock !== true,
    showDanger: r.showDanger === true,
    autoRoll: r.autoRoll === true,
    showRolls: r.showRolls === true,
    followLight: r.followLight !== false,
    showRound: r.showRound !== undefined ? r.showRound !== false : r.hideRound !== true,
    clearRollsOnCombat: r.clearRollsOnCombat !== false,
    showMarker: r.showMarker !== false,
    selectOnTurn: r.selectOnTurn !== false,
    showLights: r.showLights !== false,
    playersLight: r.playersLight === true,
    dicePlus: r.dicePlus !== false,
    showDeath: r.showDeath !== false,
    effectIcons: r.effectIcons !== false,
    remindEvery: intIn(r.remindEvery, 1, REMIND_MAX) ?? DEFAULT_SETTINGS.remindEvery,
  };
};

// The mode the panel runs: the chosen one, or manual with encounter rolls off.
export const effectiveMode = (s: Settings): EncounterMode => (s.encounterRolls ? s.encounterMode : "manual");
