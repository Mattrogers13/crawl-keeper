import { useId, useState } from "react";

import Confirm from "./Confirm";
import {
  CLOCK_DIE,
  OMEN_AT,
  cadence,
  clockLeft,
  cryptoRand,
  crawlDie,
  due,
  lastFor,
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
// crawling (it stays in view as the list scrolls). Three columns: the dial
// (what's left before the next roll), the place (danger level; darkness for
// the clock), and the d6, which is both the roll button and its last result. The card
// and the die light up when a roll is due; the die can always be rolled (an
// extra check when the GM wants one). Manual (encounter rolls off): no die,
// the card only says when to roll at the table. `start` is the clock's size.
const CrawlBar = (props: {
  crawl: Crawl;
  mode: EncounterMode;
  start: number;
  gmTurn: boolean;
  change: (fn: (c: Crawl) => Crawl) => void;
}) => {
  const { crawl, mode, start, change } = props;
  const [askingReset, setAskingReset] = useState(false);
  const clock = mode === "clock";
  const manual = mode === "manual";
  const isDue = due(crawl, mode);
  const callForRoll = isDue && props.gmTurn;
  const toNext = roundsToCheck(crawl);
  const every = cadence(crawl);
  // This mode's last roll (not the other mode's, after a switch).
  const last = lastFor(crawl, mode);

  return (
    <section
      aria-label={clock ? "Crawling Clock" : "Encounter checks"}
      className={`grid ${manual ? "grid-cols-[76px_minmax(0,1fr)]" : "grid-cols-[76px_minmax(0,1fr)_76px]"} items-start gap-3 rounded-[14px] bg-obr-bg p-2.5 ring-1 ring-inset ${
        callForRoll ? "shadow-[0_0_0_3px_color-mix(in_srgb,var(--obr-primary)_18%,transparent)] ring-obr-primary" : "ring-obr-text/10"
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        {clock ? (
          // Right-click the clock to reset it.
          <div
            title="Right-click to reset the clock"
            onContextMenu={(e) => {
              e.preventDefault();
              setAskingReset(true);
            }}
          >
            <ClockDial value={clockLeft(crawl, start)} of={start} />
          </div>
        ) : (
          <CheckDial of={every} left={toNext} due={isDue} dark={crawl.dark} />
        )}
        {/* Standard checks are rounds apart: say how far. The clock rolls every
            crawl round, so it needs no label (the die rings when it's due). */}
        {!clock && (
          <span className={`text-center text-[11px] leading-tight ${isDue ? "font-medium text-obr-primary" : "text-obr-text-secondary"}`}>
            {isDue ? "Check now" : `${plural(toNext, "round")} left`}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1.5 pt-1">
        {clock ? (
          <span className="text-sm font-medium">Crawling Clock{start > CLOCK_DIE && <span className="text-obr-text-secondary"> · 2d20</span>}</span>
        ) : (
          <DangerSelect value={crawl.danger} onChange={(d) => change((c) => setDanger(c, d))} />
        )}
        <span className="text-xs leading-snug text-obr-text-secondary">
          {clock
            ? `Crawling die d${crawlDie(crawl)}${crawl.dark ? " (darkness)" : ""}`
            : `A check every ${every === 1 ? "crawl round" : `${every} crawl rounds`}`}
          {manual && (
            <span className={`block ${isDue ? "font-medium text-obr-text" : ""}`}>
              {isDue ? "Roll a d6 at the table: an encounter on a 1" : "Encounter rolls off: you roll at the table"}
            </span>
          )}
          {clock && omen(crawl) && !crawl.last?.encounter && (
            <>
              {" · "}
              <span
                className="font-medium text-amber-700 dark:text-amber-400"
                title="The clock is low. You may roll the encounter on your table now and telegraph it; it still hits when the clock reaches 0."
              >
                Omen · {crawl.clock}
              </span>
            </>
          )}
        </span>
        {/* Standard checks have no darkness switch: total darkness is Deadly (p. 84).
            Following Torchlight, a chip says why it went Deadly. */}
        {clock ? (
          <TorchToggle dark={crawl.dark} onClick={() => change((c) => setDark(c, !c.dark))} />
        ) : (
          crawl.dark && (
            <span
              className="flex h-7 items-center gap-1.5 rounded-full bg-obr-text/10 pr-3 pl-2 text-xs font-medium text-obr-text-secondary"
              title="Every light on the party's tokens is out (Torchlight): Deadly until one comes back"
            >
              <TorchIcon lit={false} />
              Darkness
            </span>
          )
        )}
        {clock && (
          <Confirm
            label="Reset clock"
            question={`Reset the clock to ${start}?`}
            action="Reset"
            onConfirm={() => change(resetClock)}
            asking={askingReset}
            setAsking={setAskingReset}
          />
        )}
      </div>

      {!manual && (
        <div className="flex flex-col items-center gap-1">
          <D6
            roll={last}
            label={clock ? `Roll d${crawlDie(crawl)}` : "Encounter check (d6)"}
            due={isDue}
            onClick={() => change((c) => rollFor(mode, start)(c, cryptoRand))}
          />
          {/* A live region that stays mounted, so a new result is announced. */}
          <div role="status" aria-label="Last roll" className="flex flex-col items-center">
            {last ? (
              <Outcome roll={last} />
            ) : (
              <span className="text-center text-[11px] leading-tight text-obr-text-secondary">{clock ? "Crawling die" : "Encounter check"}</span>
            )}
          </div>
          {last && crawl.undo && (
            <button type="button" className="text-[11px] text-obr-text-secondary underline hover:text-obr-text" onClick={() => change(undoRoll)}>
              Undo
            </button>
          )}
        </div>
      )}
    </section>
  );
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const DANGERS: Danger[] = ["unsafe", "risky", "deadly"];

// A native select (keyboard and screen readers for free) styled as a pill.
const DangerSelect = ({ value, onChange }: { value: Danger; onChange: (d: Danger) => void }) => (
  <span className="relative inline-flex">
    <select
      aria-label="Danger level"
      title="Danger level: how often to check (core p. 112)"
      value={value}
      onChange={(e) => onChange(e.target.value as Danger)}
      className={`h-8 cursor-pointer appearance-none rounded-lg bg-obr-paper pr-7 pl-2.5 text-sm font-semibold capitalize hover:bg-obr-text/10 ${FOCUS}`}
    >
      {DANGERS.map((d) => (
        <option key={d} value={d} className="bg-obr-paper text-obr-text">
          {d[0].toUpperCase() + d.slice(1)}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-2.5 w-2.5 -translate-y-1/2 text-obr-text-secondary" />
  </span>
);

// Torchlit or total darkness (the crawling die becomes a d8).
const TorchToggle = (props: { dark: boolean; onClick: () => void }) => (
  <button
    type="button"
    aria-label="Darkness"
    aria-pressed={props.dark}
    title="Total darkness: the crawling die is a d8"
    className={`flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2 text-xs font-medium ${FOCUS} ${
      props.dark ? "bg-obr-text/10 text-obr-text-secondary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    }`}
    onClick={props.onClick}
  >
    <TorchIcon lit={!props.dark} />
    {props.dark ? "Darkness" : "Torchlit"}
  </button>
);

const TorchIcon = ({ lit }: { lit: boolean }) => (
  <svg viewBox="0 0 14 20" className="h-4 w-3" aria-hidden>
    {lit ? (
      <>
        <path d="M7 1c2 3 4 4 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-2-1-4 0-6z" fill="#ff9a3c" />
        <path d="M7 5c1 2 2 2.5 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z" fill="#ffe08a" />
      </>
    ) : (
      <path d="M6 2c-1 1 1 2 0 3M8 1c-1 1 1 2 0 3" stroke="currentColor" fill="none" />
    )}
    <rect x="5" y="10" width="4" height="9" rx="1" fill="#8a6a45" />
    <rect x="4" y="9" width="6" height="2" rx="1" fill={lit ? "#5a3d22" : "currentColor"} />
  </svg>
);

const ChevronDown = ({ className }: { className: string }) => (
  <svg viewBox="0 0 10 10" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1.5 3.5 5 7l3.5-3.5" />
  </svg>
);

// The d6: the GM presses it to roll; it shows the last roll (pips for a
// check, the total for the crawling die). Red on an encounter, ringed while a
// roll is due. Without onClick (players) it's a picture of the roll.
const D6 = (props: { roll: CrawlRoll | null; label: string; due?: boolean; onClick?: () => void; small?: boolean }) => {
  const { roll } = props;
  const enc = roll?.encounter ?? false;
  const Face = props.onClick ? "button" : "span";
  return (
    <div className={`flex shrink-0 items-center justify-center ${props.small ? "h-[52px] w-[52px]" : "h-[76px] w-[76px]"}`}>
      <Face
        {...(props.onClick ? { type: "button" as const, onClick: props.onClick, title: `${props.label} (R when due)` } : { role: "img" })}
        aria-label={props.label}
        className={`relative flex items-center justify-center rounded-xl ${props.small ? "h-11 w-11" : "h-14 w-14"} ${
          props.onClick
            ? "transition-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obr-primary focus-visible:ring-offset-2 focus-visible:ring-offset-obr-bg"
            : ""
        } ${
          enc ? "bg-red-600 text-white shadow-[0_4px_0_#8f2a2a,0_8px_14px_rgba(0,0,0,.35)]" : "bg-[#f4f1ea] text-[#1b1b1b] shadow-[0_4px_0_#b9b2a3,0_8px_14px_rgba(0,0,0,.35)]"
        } ${props.due ? "outline-3 outline-offset-3 outline-obr-primary/60" : ""}`}
      >
        {!roll ? (
          <span className="text-xs font-bold tracking-wide uppercase opacity-60">Roll</span>
        ) : roll.kind === "check" ? (
          <Pips n={roll.dice[0]} />
        ) : (
          <>
            <span className="text-[22px] font-extrabold tabular-nums">{roll.dice.reduce((a, b) => a + b, 0)}</span>
            <span className="absolute -top-1.5 -right-1.5 rounded-md bg-obr-paper px-1 text-[9.5px] font-medium text-obr-text-secondary ring-1 ring-obr-text/10">
              d{roll.sides}
            </span>
          </>
        )}
      </Face>
    </div>
  );
};

// The players' view of the last roll (the GM's "Show the rolls" setting).
export const PlayerRoll = ({ roll }: { roll: CrawlRoll }) => (
  <span className="flex items-center gap-2">
    <D6 roll={roll} label={roll.kind === "clock" ? `Crawling die: ${roll.dice.reduce((a, b) => a + b, 0)}` : `Encounter check: ${roll.dice[0]}`} small />
    <Outcome roll={roll} />
  </span>
);

// Pip spots in percent of the face.
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};
const Pips = ({ n }: { n: number }) => (
  <>
    <span className="sr-only">{n}</span>
    {(PIPS[n] ?? []).map(([x, y], i) => (
      <i
        key={i}
        aria-hidden
        className="absolute h-2.5 w-2.5 rounded-full bg-current"
        style={{ left: `calc(${x}% - 5px)`, top: `calc(${y}% - 5px)` }}
      />
    ))}
  </>
);

// What the last roll did, under the die.
const Outcome = ({ roll }: { roll: CrawlRoll }) => {
  const total = roll.dice.reduce((a, b) => a + b, 0);
  const text = roll.encounter ? "Encounter!" : roll.kind === "check" ? "No encounter" : `Clock ${roll.before} → ${roll.after}`;
  return (
    <span
      className={`text-center text-[11px] leading-tight ${roll.encounter ? "font-bold text-red-600 uppercase dark:text-red-400" : "text-obr-text-secondary"}`}
      title={roll.dice.length > 1 ? `${roll.dice.join(" + ")} = ${total}` : undefined}
    >
      {text}
      {roll.kind === "clock" && roll.encounter && <span className="block font-medium normal-case">Next clock {roll.after}</span>}
    </span>
  );
};

// The dial's d20, a sapphire resin die seen face-on: a hexagon, nine lit
// facets and a front face drawn bigger than a real d20's so the number sits
// fully on it. Drawn on a 76-unit grid, centred on 38, 38.
const C = 38;
const D20_R = 26;
const FACE_K = 0.86;
const at = (deg: number) => [C + D20_R * Math.cos((deg * Math.PI) / 180), C + D20_R * Math.sin((deg * Math.PI) / 180)];
const HEX = [-90, -30, 30, 90, 150, 210].map(at);
const FACE = [
  [C, C - FACE_K * D20_R],
  [C + 0.84 * FACE_K * D20_R, C + 0.62 * FACE_K * D20_R],
  [C - 0.84 * FACE_K * D20_R, C + 0.62 * FACE_K * D20_R],
];
const FACE_CY = (FACE[0][1] + FACE[1][1] + FACE[2][1]) / 3;
const FACETS = [
  [FACE[0], HEX[0], HEX[1]], [FACE[0], HEX[1], FACE[1]], [FACE[1], HEX[1], HEX[2]],
  [FACE[1], HEX[2], HEX[3]], [FACE[1], HEX[3], FACE[2]], [FACE[2], HEX[3], HEX[4]],
  [FACE[2], HEX[4], HEX[5]], [FACE[2], HEX[5], FACE[0]], [FACE[0], HEX[5], HEX[0]],
];
// Light from the top-left: how much white each facet gets.
const FACET_LIGHT = [0.28, 0.14, 0.06, 0, 0, 0.04, 0.1, 0.2, 0.34];
const path = (points: number[][]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}Z`;
const EDGE = "#0c1d4a";

const D20 = ({ text }: { text: string }) => {
  const id = useId();
  const size = text.length > 1 ? 15 : 18;
  const y = FACE_CY + size * 0.36;
  return (
    <g strokeLinejoin="round">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9cc4ff" />
          <stop offset="1" stopColor="#1d3f8f" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f97ff" />
          <stop offset="1" stopColor="#2c5bd0" />
        </linearGradient>
      </defs>
      <path d={path(HEX)} fill={`url(#${id}b)`} stroke={EDGE} />
      {FACETS.map((f, i) => (
        <path key={i} d={path(f)} fill={`rgba(255,255,255,${FACET_LIGHT[i]})`} stroke={EDGE} strokeOpacity={0.55} strokeWidth={0.8} />
      ))}
      <path d={path(FACE)} fill={`url(#${id}f)`} stroke={EDGE} strokeOpacity={0.6} strokeWidth={0.8} />
      <text x={C} y={y + 0.8} textAnchor="middle" fontSize={size} fontWeight="800" fill="rgba(5,15,60,.6)" aria-hidden>
        {text}
      </text>
      <text x={C} y={y} textAnchor="middle" fontSize={size} fontWeight="800" fill="#fff" className="tabular-nums">
        {text}
      </text>
    </g>
  );
};

const RING_R = 32;
const RING_W = 7;

// The clock as a ring that empties as it runs down, around the d20 showing
// what's left; amber at omen range. A 2d20 clock (`of` 40) runs one die at a
// time: the d20 shows the front die, "+20" while the second is still full,
// and a notch marks where one die ends. Scaled to `size` px (the players'
// card uses a small one).
export const ClockDial = ({ value, of = CLOCK_DIE, size = 76 }: { value: number; of?: number; size?: number }) => {
  const length = 2 * Math.PI * RING_R;
  const filled = (Math.max(0, Math.min(value, of)) / of) * length;
  const spare = value > CLOCK_DIE;
  return (
    <svg viewBox="0 0 76 76" width={size} height={size} className="shrink-0" role="img" aria-label={`Clock ${value} of ${of}`}>
      <circle cx={C} cy={C} r={RING_R} fill="none" strokeWidth={RING_W} className="stroke-obr-text/15" />
      <circle
        cx={C}
        cy={C}
        r={RING_R}
        fill="none"
        strokeWidth={RING_W}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${length}`}
        transform={`rotate(-90 ${C} ${C})`}
        className={value <= OMEN_AT ? "stroke-amber-600 dark:stroke-amber-400" : "stroke-obr-primary"}
      />
      {of > CLOCK_DIE && <rect x={C - 1.25} y={C + RING_R - RING_W / 2 - 0.5} width={2.5} height={RING_W + 1} className="fill-obr-bg" />}
      <D20 text={String(spare ? value - CLOCK_DIE : value)} />
      {spare && (
        <g aria-hidden>
          <rect x={47} y={56} width={24} height={14} rx={4} className="fill-obr-paper stroke-obr-text/20" strokeWidth={1} />
          <text x={59} y={66.5} textAnchor="middle" fontSize={10} fontWeight="700" className="fill-obr-text">
            +{CLOCK_DIE}
          </text>
        </g>
      )}
    </svg>
  );
};

// Standard checks: one ring segment per crawl round between checks, filling
// as they pass; the d20 shows the rounds left, "!" when the check is due.
// Ember while in darkness (a check every round).
const CheckDial = (props: { of: number; left: number; due: boolean; dark: boolean }) => {
  const length = 2 * Math.PI * RING_R;
  // Round caps reach half the stroke past each end: leave room for them.
  const step = length / props.of;
  const gap = props.of === 1 ? 0 : 5 + RING_W;
  const seg = step - gap;
  const passed = props.due ? props.of : props.of - props.left;
  return (
    <svg
      viewBox="0 0 76 76"
      width={76}
      height={76}
      className="shrink-0"
      role="img"
      aria-label={props.due ? "Check due" : `${plural(props.left, "crawl round")} to the next check`}
    >
      {Array.from({ length: props.of }, (_, i) => (
        <circle
          key={i}
          cx={C}
          cy={C}
          r={RING_R}
          fill="none"
          strokeWidth={RING_W}
          strokeLinecap={gap ? "round" : "butt"}
          strokeDasharray={`${seg} ${length - seg}`}
          strokeDashoffset={-(i * step + gap / 2)}
          transform={`rotate(-90 ${C} ${C})`}
          className={i < passed ? (props.dark ? "stroke-orange-400" : "stroke-obr-primary") : "stroke-obr-text/15"}
        />
      ))}
      <D20 text={props.due ? "!" : String(props.left)} />
    </svg>
  );
};

// One focus style for the pill controls.
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obr-primary";

export default CrawlBar;
