import { useState, type ReactNode } from "react";

import Confirm from "./Confirm";
import {
  CLOCK_START,
  OMEN_AT,
  cryptoRand,
  crawlDie,
  due,
  omen,
  resetClock,
  rollFor,
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
// the roll on the GM's turn when one is due; the roll button is always there
// (an extra roll when the GM wants one), outlined while a roll is due and
// filled when it's due on the GM's turn.
const CrawlBar = (props: { crawl: Crawl; mode: EncounterMode; gmTurn: boolean; change: (fn: (c: Crawl) => Crawl) => void }) => {
  const { crawl, mode, change } = props;
  const [askingReset, setAskingReset] = useState(false);
  const clock = mode === "clock";
  const isDue = due(crawl, mode);
  const callForRoll = isDue && props.gmTurn;
  const toNext = roundsToCheck(crawl);
  const status =
    crawl.crawlRounds === 0
      ? "Starts with the first crawl round"
      : isDue
        ? "Due this round"
        : clock
          ? "Rolled this round"
          : `Next in ${toNext} crawl round${toNext === 1 ? "" : "s"}`;

  return (
    <section
      aria-label={clock ? "Crawling Clock" : "Encounter checks"}
      className={`grid items-center gap-x-3 gap-y-2.5 rounded-xl bg-obr-bg p-3 text-sm ring-1 ring-inset ${
        clock ? "grid-cols-[76px_minmax(0,1fr)]" : "grid-cols-1"
      } ${callForRoll ? "ring-obr-primary" : "ring-obr-text/10"}`}
    >
      {clock && (
        // Right-click the clock to reset it.
        <div
          title="Right-click to reset the clock"
          onContextMenu={(e) => {
            e.preventDefault();
            setAskingReset(true);
          }}
        >
          <ClockDial value={crawl.clock} />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!clock && (
            <div role="group" aria-label="Danger level" className="flex rounded-full bg-obr-paper p-0.5 text-xs font-medium">
              {(["unsafe", "risky", "deadly"] as const).map((d: Danger) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={crawl.danger === d}
                  className={`h-8 rounded-full px-3 capitalize ${FOCUS} ${crawl.danger === d ? "bg-obr-primary text-obr-primary-contrast" : "hover:bg-obr-text/10"}`}
                  onClick={() => change((c) => setDanger(c, d))}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <PillButton
            look={callForRoll ? "filled" : isDue ? "outlined" : "plain"}
            hint="R when due"
            onClick={() => change((c) => rollFor(mode)(c, cryptoRand))}
          >
            {clock ? `Roll d${crawlDie(crawl)}` : "Roll check (d6)"}
          </PillButton>
          <button
            type="button"
            aria-pressed={crawl.dark}
            title={clock ? "Total darkness: the crawling die is a d8" : "Total darkness: a check every crawl round (p. 84)"}
            className={`h-8 rounded-full px-3 text-xs font-medium ${FOCUS} ${
              crawl.dark ? "bg-obr-text text-obr-paper" : "bg-obr-paper text-obr-text-secondary hover:bg-obr-text/10"
            }`}
            onClick={() => change((c) => setDark(c, !c.dark))}
          >
            Darkness · {clock ? "d8" : "every round"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-obr-text-secondary">
          <span role="status" className={isDue ? "font-medium text-obr-primary" : ""}>
            {status}
          </span>
          {clock && omen(crawl) && !crawl.last?.encounter && (
            <>
              <span aria-hidden>·</span>
              <span
                className="font-medium text-amber-700 dark:text-amber-400"
                title="The clock is low. You may roll the encounter on your table now and telegraph it; it still hits when the clock reaches 0."
              >
                Omen · {crawl.clock}
              </span>
            </>
          )}
          {crawl.undo && (
            <>
              <span aria-hidden>·</span>
              <button type="button" className="underline hover:text-obr-text" onClick={() => change(undoRoll)}>
                Undo
              </button>
            </>
          )}
          {clock && (
            <>
              <span aria-hidden>·</span>
              <Confirm
                label="Reset clock"
                question={`Reset the clock to ${CLOCK_START}?`}
                action="Reset"
                onConfirm={() => change(resetClock)}
                asking={askingReset}
                setAsking={setAskingReset}
              />
            </>
          )}
        </div>
      </div>

      {crawl.last && <LastRoll roll={crawl.last} />}
    </section>
  );
};

// A d20 seen face-on (the clock starts at 20): a hexagon, the front face,
// and the edges between them. Drawn for a 76 px dial, centred on 38, 38.
const D20_R = 24;
const at = (deg: number, r = D20_R) => [38 + r * Math.cos((deg * Math.PI) / 180), 38 + r * Math.sin((deg * Math.PI) / 180)];
const HEX = [-90, -30, 30, 90, 150, 210].map((deg) => at(deg));
const FACE = [
  [38, 38 - 0.5 * D20_R],
  [38 + 0.55 * D20_R, 38 + 0.38 * D20_R],
  [38 - 0.55 * D20_R, 38 + 0.38 * D20_R],
];
const path = (points: number[][]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}Z`;
// Each corner of the face joins the three hexagon corners nearest it.
const EDGES = [
  [0, 0], [0, 1], [0, 5],
  [1, 1], [1, 2], [1, 3],
  [2, 3], [2, 4], [2, 5],
]
  .map(([f, h]) => `M${FACE[f].map((n) => n.toFixed(1)).join(" ")} L${HEX[h].map((n) => n.toFixed(1)).join(" ")}`)
  .join(" ");

// The clock as a ring that empties as it runs down, around a d20 showing
// what's left. Drawn on a 76-unit grid and scaled to `size` px; small dials
// (the players' view) get a bolder ring and number so they still read.
// `on`: what it sits on (the number's outline matches it, so the die's edges
// don't cut through the number).
export const ClockDial = ({ value, size = 76, on = "bg" }: { value: number; size?: number; on?: "bg" | "paper" }) => {
  const small = size < 60;
  const stroke = small ? 7 : 5;
  const r = 38 - stroke / 2 - 1;
  const length = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(value, CLOCK_START)) / CLOCK_START) * length;
  const line = small ? 1.8 : 1.2;
  return (
    <svg viewBox="0 0 76 76" width={size} height={size} className="shrink-0" role="img" aria-label={`Clock ${value} of ${CLOCK_START}`}>
      <circle cx="38" cy="38" r={r} fill="none" strokeWidth={stroke} className="stroke-obr-text/15" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${length}`}
        transform="rotate(-90 38 38)"
        className={value <= OMEN_AT ? "stroke-amber-600 dark:stroke-amber-500" : "stroke-obr-primary"}
      />
      <g strokeLinejoin="round">
        <path d={path(HEX)} strokeWidth={line} className="fill-obr-text/5 stroke-obr-text/45" />
        <path d={EDGES} strokeWidth={line * 0.8} className="stroke-obr-text/25" />
        <path d={path(FACE)} fill="none" strokeWidth={line} className="stroke-obr-text/45" />
        <text
          x="38"
          y={38 + 0.16 * D20_R + (small ? 7 : 5)}
          textAnchor="middle"
          fontSize={small ? 22 : 16}
          fontWeight="700"
          strokeWidth={small ? 4 : 3}
          paintOrder="stroke"
          className={`fill-obr-text tabular-nums ${on === "paper" ? "stroke-obr-paper" : "stroke-obr-bg"}`}
        >
          {value}
        </text>
      </g>
    </svg>
  );
};

// The last roll, big: the dice as chips, then what happened.
const LastRoll = ({ roll }: { roll: CrawlRoll }) => {
  const total = roll.dice.reduce((a, b) => a + b, 0);
  const outcome =
    roll.kind === "check"
      ? roll.encounter
        ? "Encounter!"
        : "No encounter"
      : roll.encounter
        ? "Encounter!"
        : `Clock ${roll.before} → ${roll.after}`;
  return (
    <div
      aria-live="polite"
      aria-label="Last roll"
      className={`col-span-full flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 ${
        roll.encounter ? "bg-red-700 text-white" : "bg-obr-paper"
      }`}
    >
      {roll.dice.map((d, i) => (
        <span key={i} className="contents">
          {i > 0 && (
            <span className="text-obr-text-secondary" aria-hidden>
              +
            </span>
          )}
          <span
            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1 text-lg font-bold tabular-nums ${
              roll.encounter ? "bg-white text-red-700" : "bg-obr-text text-obr-paper"
            }`}
          >
            {d}
          </span>
        </span>
      ))}
      {roll.dice.length > 1 && <span className="text-lg font-bold tabular-nums">= {total}</span>}
      <span className="ml-auto flex flex-col items-end text-base leading-tight font-bold">
        {outcome}
        {roll.kind === "clock" && roll.encounter && <span className="text-xs font-medium">Next clock {roll.after}</span>}
      </span>
    </div>
  );
};

// One focus style for the pill controls.
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obr-primary";

const PILL_LOOK = {
  filled: "bg-obr-primary text-obr-primary-contrast",
  outlined: "bg-obr-paper text-obr-primary ring-2 ring-obr-primary ring-inset hover:bg-obr-primary/10",
  plain: "bg-obr-paper ring-1 ring-obr-text/20 ring-inset hover:bg-obr-text/10",
};

// `hint`: its hotkey, shown in the tooltip.
const PillButton = (props: { look: keyof typeof PILL_LOOK; hint?: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    title={props.hint && `Roll (${props.hint})`}
    className={`h-9 rounded-full px-4 text-sm font-medium ${FOCUS} ${PILL_LOOK[props.look]}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default CrawlBar;
