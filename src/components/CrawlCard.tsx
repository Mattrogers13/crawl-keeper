import type { ReactNode } from "react";

import {
  CLOCK_START,
  cryptoRand,
  crawlDie,
  due,
  encounterNow,
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

// The GM's encounter checks or Crawling Clock, under the GM / Monsters row
// while crawling. Always shown (status, darkness, a roll for loud noises);
// it calls for the roll on the GM's turn when one is due.
const CrawlCard = (props: { crawl: Crawl; mode: EncounterMode; gmTurn: boolean; change: (fn: (c: Crawl) => Crawl) => void }) => {
  const { crawl, mode, change } = props;
  const isDue = due(crawl, mode);
  const callForRoll = isDue && props.gmTurn;
  const die = `d${crawlDie(crawl)}`;

  return (
    <section
      aria-label={mode === "clock" ? "Crawling Clock" : "Encounter checks"}
      className={`mt-1 flex flex-col gap-1.5 rounded p-2 text-sm ${callForRoll ? "bg-obr-primary/15 ring-1 ring-obr-primary" : "bg-obr-bg"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {mode === "clock" ? (
          <span className="font-semibold">
            Crawling Clock <span className="ml-1 text-lg tabular-nums">{crawl.clock}</span>
            <span className="text-xs font-normal text-obr-text-secondary"> / {CLOCK_START}</span>
          </span>
        ) : (
          <>
            <span className="font-semibold">Encounter checks</span>
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
        <label className="ml-auto flex items-center gap-1 text-xs" title="Total darkness: checks every round; the crawling die becomes a d8">
          <input type="checkbox" checked={crawl.dark} onChange={(e) => change((c) => setDark(c, e.target.checked))} />
          In darkness
        </label>
      </div>

      <p className="text-xs text-obr-text-secondary" role="status">
        {mode === "clock"
          ? isDue
            ? `Roll the crawling die (${die}) on the GM turn.`
            : "Rolled for this crawl round."
          : isDue
            ? "A check is due on the GM turn."
            : `Next check in ${roundsToCheck(crawl)} crawl round${roundsToCheck(crawl) === 1 ? "" : "s"}.`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "clock" ? (
          <CardButton primary={callForRoll} onClick={() => change((c) => rollClock(c, cryptoRand))}>
            {isDue ? `Roll ${die}` : `Roll ${die} again (loud noise)`}
          </CardButton>
        ) : (
          <CardButton primary={callForRoll} onClick={() => change((c) => rollCheck(c, cryptoRand))}>
            {isDue ? "Roll check (d6)" : "Check now (loud noise)"}
          </CardButton>
        )}
        {mode === "clock" && omen(crawl) && (
          <CardButton onClick={() => change(encounterNow)}>Roll the encounter now</CardButton>
        )}
        <div className="ml-auto flex gap-2 text-xs">
          {crawl.undo && (
            <button type="button" className="text-obr-text-secondary underline hover:text-obr-text" onClick={() => change(undoRoll)}>
              Undo
            </button>
          )}
          {mode === "clock" && (
            <button type="button" className="text-obr-text-secondary underline hover:text-obr-text" onClick={() => change(resetClock)}>
              New clock
            </button>
          )}
        </div>
      </div>

      {crawl.last && <LastRoll roll={crawl.last} />}
      {mode === "clock" && omen(crawl) && !crawl.last?.encounter && (
        <p className="text-xs text-amber-500">Omen: the clock is low. Telegraph what's coming, or roll the encounter now.</p>
      )}
    </section>
  );
};

const LastRoll = ({ roll }: { roll: CrawlRoll }) => {
  const dice = roll.dice.join(" + ");
  const total = roll.dice.reduce((a, b) => a + b, 0);
  const text =
    roll.kind === "early"
      ? `Encounter rolled early at ${roll.before}. New clock: ${roll.after}.`
      : roll.kind === "check"
        ? `Rolled ${dice}: ${roll.encounter ? "encounter!" : "no encounter."}`
        : roll.encounter
          ? `Rolled ${dice}${roll.dice.length > 1 ? ` = ${total}` : ""}: the clock hits 0. Encounter! Next clock: ${roll.after}.`
          : `Rolled ${dice}${roll.dice.length > 1 ? ` = ${total}` : ""}: clock ${roll.before} → ${roll.after}.`;
  return (
    <p className={`text-sm ${roll.encounter ? "font-semibold text-red-500" : ""}`} aria-live="polite">
      {text}
    </p>
  );
};

const CardButton = ({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    className={`rounded px-2 py-0.5 text-sm font-medium ${primary ? "bg-obr-primary text-obr-primary-contrast" : "border border-obr-text-disabled"}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export default CrawlCard;
