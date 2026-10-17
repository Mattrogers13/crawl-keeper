import { useId, useState } from "react";

import Confirm from "./Confirm";
import {
  CLOCK_START,
  OMEN_AT,
  cadence,
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
// crawling (it stays in view as the list scrolls). Three columns: the dial
// (what's left before the next roll), the place (danger level, darkness),
// and the d6, which is both the roll button and its last result. The card
// and the die light up when a roll is due; the die can always be rolled (an
// extra check when the GM wants one).
const CrawlBar = (props: { crawl: Crawl; mode: EncounterMode; gmTurn: boolean; change: (fn: (c: Crawl) => Crawl) => void }) => {
  const { crawl, mode, change } = props;
  const [askingReset, setAskingReset] = useState(false);
  const clock = mode === "clock";
  const isDue = due(crawl, mode);
  const callForRoll = isDue && props.gmTurn;
  const started = crawl.crawlRounds > 0;
  const toNext = roundsToCheck(crawl);
  const every = cadence(crawl);
  // Under the dial.
  const dialLabel = isDue ? (clock ? "Roll now" : "Check now") : !clock ? plural(toNext, "round") + " left" : started ? "Rolled" : "Rolls from round 1";
  // Darkness changes nothing for a Deadly place's standard checks.
  const darkMatters = clock || crawl.danger !== "deadly";

  return (
    <section
      aria-label={clock ? "Crawling Clock" : "Encounter checks"}
      className={`grid grid-cols-[76px_minmax(0,1fr)_76px] items-start gap-3 rounded-[14px] bg-obr-bg p-2.5 ring-1 ring-inset ${
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
            <ClockDial value={crawl.clock} />
          </div>
        ) : (
          <CheckDial of={every} left={toNext} due={isDue} dark={crawl.dark} />
        )}
        <span className={`text-center text-[11px] leading-tight ${isDue ? "font-medium text-obr-primary" : "text-obr-text-secondary"}`}>
          {dialLabel}
        </span>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1.5 pt-1">
        {clock ? (
          <span className="text-sm font-medium">Crawling Clock</span>
        ) : (
          <DangerSelect value={crawl.danger} onChange={(d) => change((c) => setDanger(c, d))} />
        )}
        <span className="text-xs leading-snug text-obr-text-secondary">
          {clock
            ? `Crawling die d${crawlDie(crawl)}${crawl.dark ? " (darkness)" : ""}`
            : `A check every ${every === 1 ? "crawl round" : `${every} crawl rounds`}`}
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
        <TorchToggle
          dark={crawl.dark}
          matters={darkMatters}
          title={
            !darkMatters
              ? "Total darkness: Deadly already checks every crawl round"
              : clock
                ? "Total darkness: the crawling die is a d8"
                : "Total darkness: a check every crawl round (p. 84)"
          }
          onClick={() => change((c) => setDark(c, !c.dark))}
        />
        {clock && (
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

      <div className="flex flex-col items-center gap-1">
        <D6Button
          roll={crawl.last}
          label={clock ? `Roll d${crawlDie(crawl)}` : "Encounter check (d6)"}
          due={isDue}
          onClick={() => change((c) => rollFor(mode)(c, cryptoRand))}
        />
        <span aria-live="polite" aria-label="Last roll" className="contents">
          {crawl.last && <Outcome roll={crawl.last} />}
        </span>
        {!crawl.last && <span className="text-center text-[11px] leading-tight text-obr-text-secondary">{clock ? "Crawling die" : "Encounter check"}</span>}
        {crawl.undo && (
          <button type="button" className="text-[11px] text-obr-text-secondary underline hover:text-obr-text" onClick={() => change(undoRoll)}>
            Undo
          </button>
        )}
      </div>
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

// Torchlit or total darkness. Greyed (still clickable) where it changes
// nothing: a Deadly place already checks every round.
const TorchToggle = (props: { dark: boolean; matters: boolean; title: string; onClick: () => void }) => (
  <button
    type="button"
    aria-label="Darkness"
    aria-pressed={props.dark}
    title={props.title}
    className={`flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2 text-xs font-medium ${FOCUS} ${
      props.dark ? "bg-obr-text/10 text-obr-text-secondary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    } ${props.matters ? "" : "opacity-50"}`}
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

// The d6: press it to roll; it shows the last roll (pips for a check, the
// total for the crawling die). Red on an encounter, ringed while a roll is due.
const D6Button = (props: { roll: CrawlRoll | null; label: string; due: boolean; onClick: () => void }) => {
  const { roll } = props;
  const enc = roll?.encounter ?? false;
  return (
    <div className="flex h-[76px] w-[76px] items-center justify-center">
      <button
        type="button"
        aria-label={props.label}
        title={`${props.label} (R when due)`}
        className={`relative h-14 w-14 rounded-xl transition-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obr-primary focus-visible:ring-offset-2 focus-visible:ring-offset-obr-bg ${
          enc ? "bg-red-600 text-white shadow-[0_4px_0_#8f2a2a,0_8px_14px_rgba(0,0,0,.35)]" : "bg-[#f4f1ea] text-[#1b1b1b] shadow-[0_4px_0_#b9b2a3,0_8px_14px_rgba(0,0,0,.35)]"
        } ${props.due ? "outline-3 outline-offset-3 outline-obr-primary/60" : ""}`}
        onClick={props.onClick}
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
      </button>
    </div>
  );
};

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
// what's left; amber at omen range. Scaled to `size` px (the players' card
// uses a small one).
export const ClockDial = ({ value, size = 76 }: { value: number; size?: number }) => {
  const length = 2 * Math.PI * RING_R;
  const filled = (Math.max(0, Math.min(value, CLOCK_START)) / CLOCK_START) * length;
  return (
    <svg viewBox="0 0 76 76" width={size} height={size} className="shrink-0" role="img" aria-label={`Clock ${value} of ${CLOCK_START}`}>
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
      <D20 text={String(value)} />
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
