import { useState, type ReactNode } from "react";

import Confirm from "./Confirm";
import {
  CLOCK_START,
  cryptoRand,
  crawlDie,
  due,
  omen,
  resetClock,
  rollCheck,
  rollClock,
  roundsToCheck,
  setDanger,
  setDark,
  undoRoll,
  type Crawl,
  type CrawlRoll,
  type Danger,
  type EncounterMode,
} from "../crawl";

// The GM's encounter checks or Crawling Clock, in the top bar while
// crawling (it stays in view as the list scrolls). It lights up and asks for
// the roll on the GM's turn when one is due; the roll button only shows then.
const CrawlBar = (props: { crawl: Crawl; mode: EncounterMode; gmTurn: boolean; change: (fn: (c: Crawl) => Crawl) => void }) => {
  const { crawl, mode, change } = props;
  const [askingReset, setAskingReset] = useState(false);
  const isDue = due(crawl, mode);
  const callForRoll = isDue && props.gmTurn;
  const die = `d${crawlDie(crawl)}`;
  const toNext = roundsToCheck(crawl);

  return (
    <section
      aria-label={mode === "clock" ? "Crawling Clock" : "Encounter checks"}
      className={`flex flex-col gap-1.5 rounded p-2 text-sm ${callForRoll ? "bg-obr-primary/15 ring-1 ring-obr-primary" : "bg-obr-bg"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {mode === "clock" ? (
          // Right-click the clock to reset it.
          <span
            className="font-semibold"
            title="Right-click to reset the clock"
            onContextMenu={(e) => {
              e.preventDefault();
              setAskingReset(true);
            }}
          >
            Clock <span className="text-lg tabular-nums">{crawl.clock}</span>
            <span className="text-xs font-normal text-obr-text-secondary"> / {CLOCK_START}</span>
          </span>
        ) : (
          <>
            <span className="font-semibold">Checks</span>
            <div role="group" aria-label="Danger level" className="flex overflow-hidden rounded border border-obr-text-disabled text-xs">
              {(["unsafe", "risky", "deadly"] as const).map((d: Danger) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={crawl.danger === d}
                  className={`px-1.5 py-0.5 capitalize ${crawl.danger === d ? "bg-obr-primary text-obr-primary-contrast" : ""}`}
                  onClick={() => change((c) => setDanger(c, d))}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="ml-auto flex items-center gap-1 text-xs">
          <input type="checkbox" checked={crawl.dark} onChange={(e) => change((c) => setDark(c, e.target.checked))} />
          In darkness
          <span className="text-obr-text-secondary">{mode === "clock" ? "(d8)" : "(every round)"}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDue && mode === "clock" && (
          <BarButton primary={callForRoll} onClick={() => change((c) => rollClock(c, cryptoRand))}>
            Roll {die}
          </BarButton>
        )}
        {isDue && mode === "standard" && (
          <BarButton primary={callForRoll} onClick={() => change((c) => rollCheck(c, cryptoRand))}>
            Roll check (d6)
          </BarButton>
        )}
        <span className="text-xs text-obr-text-secondary" role="status">
          {crawl.crawlRounds === 0
            ? "Starts with the first crawl round"
            : isDue
              ? "Due this round"
              : mode === "clock"
                ? "Rolled this round"
                : `Next in ${toNext} crawl round${toNext === 1 ? "" : "s"}`}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {crawl.undo && (
            <button type="button" className="text-obr-text-secondary underline hover:text-obr-text" onClick={() => change(undoRoll)}>
              Undo
            </button>
          )}
          {mode === "clock" && (
            <Confirm
              label="Reset clock"
              question={`Reset the clock to ${CLOCK_START}?`}
              action="Reset"
              onConfirm={() => change(resetClock)}
              asking={askingReset}
              setAsking={setAskingReset}
            />
          )}
        </div>
      </div>

      {crawl.last && <LastRoll roll={crawl.last} />}
      {mode === "clock" && omen(crawl) && !crawl.last?.encounter && (
        <p className="text-xs font-medium text-amber-500">
          Omen: the clock is at {crawl.clock}. You may roll the encounter on your table now and telegraph it; it still
          hits when the clock reaches 0.
        </p>
      )}
    </section>
  );
};

// The last roll, big: the dice, then what happened.
const LastRoll = ({ roll }: { roll: CrawlRoll }) => {
  const total = roll.dice.reduce((a, b) => a + b, 0);
  const outcome =
    roll.kind === "check"
        ? roll.encounter
          ? "Encounter!"
          : "No encounter"
        : roll.encounter
          ? `Encounter! Next clock: ${roll.after}`
          : `Clock ${roll.before} → ${roll.after}`;
  return (
    <div
      aria-live="polite"
      aria-label="Last roll"
      className={`flex flex-wrap items-center gap-2 rounded px-2 py-1.5 ${roll.encounter ? "bg-red-700 text-white" : "bg-obr-paper"}`}
    >
      {roll.dice.map((d, i) => (
        <span
          key={i}
          className={`flex h-8 min-w-8 items-center justify-center rounded border-2 px-1 text-lg font-bold tabular-nums ${
            roll.encounter ? "border-white" : "border-obr-text-secondary"
          }`}
        >
          {d}
        </span>
      ))}
      {roll.dice.length > 1 && <span className="text-lg font-bold tabular-nums">= {total}</span>}
      <span className={`text-lg font-bold ${roll.encounter ? "uppercase tracking-wide" : ""}`}>{outcome}</span>
    </div>
  );
};

const BarButton = ({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    className={`rounded px-2 py-0.5 text-sm font-medium ${primary ? "bg-obr-primary text-obr-primary-contrast" : "border border-obr-text-disabled"}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export default CrawlBar;
