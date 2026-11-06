// The GM's Time passes sheet, over the list (the ⏳ beside the title): quick
// picks or any time, and what it will do before it's done: lights burn down
// or out, rounds effects end (p. 82); focus and ongoing effects stay.
import { useEffect, useRef, useState, type FormEvent } from "react";

import { FOCUS } from "./CrawlBar";
import { ICONS } from "./LightTracker";
import type { LightChange } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import { timePassesEffects, type Effects } from "../effects";
import { sayTimePassed } from "../lightNotices";
import { formatRemaining, LIGHT_KINDS, parseTimeEntry, remaining, timePasses, type Lights } from "../lights";

// A rest is 8 hours of sleep (p. 86).
const PICKS: [string, string][] = [
  ["10m", "10m"],
  ["30m", "30m"],
  ["1h", "1h"],
  ["8h", "8h rest"],
];

const TimeSheet = (props: { lights: Lights; effects: Effects; change: LightChange; names: Map<string, string>; close: () => void }) => {
  const now = useNow();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const ms = parseTimeEntry(text);

  const pass = (ev: FormEvent) => {
    ev.preventDefault();
    if (ms === null) return setError("Try 10m, 1h, 1:30 or 90 (minutes), up to 24 hours.");
    props.change(`Time passes ${text.trim()}`, (s, at) => timePasses(s, at, ms), { saved: () => void sayTimePassed(ms), effects: timePassesEffects });
    props.close();
  };

  // What happens, for the time typed.
  const after = ms === null ? null : timePasses(props.lights, now, ms);
  const lit = props.lights.lights.filter((l) => l.status === "lit" && remaining(l, now) > 0);
  const ending = props.effects.effects.filter((e) => e.kind === "rounds");
  const staying = props.effects.effects.filter((e) => e.kind !== "rounds");
  const holder = (id: string | null) => (id === null ? "" : ` on ${props.names.get(id) ?? "a token"}`);

  return (
    <form
      aria-label="Time passes"
      className="flex min-h-full flex-col gap-2.5 bg-obr-paper px-1 pt-1 pb-2 text-sm"
      onSubmit={pass}
      onKeyDown={(ev) => ev.key === "Escape" && props.close()}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">Time passes</span>
        <button type="button" aria-label="Close" className="rounded-md p-1 text-obr-text-secondary hover:bg-obr-text/10" onClick={props.close}>
          ✕
        </button>
      </div>
      <div role="group" aria-label="Quick picks" className="grid grid-cols-4 gap-1.5">
        {PICKS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={text === value}
            title={value === "8h" ? "A rest: 8 hours of sleep (p. 86)" : undefined}
            className={`h-9 rounded-[10px] text-sm font-medium ${text === value ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-bg hover:bg-obr-text/10"} ${FOCUS}`}
            onClick={() => {
              setText(value);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        aria-label="How long"
        value={text}
        placeholder="Or type any time: 10m, 1h, 1:30"
        onChange={(ev) => {
          setText(ev.target.value);
          setError("");
        }}
        className="h-9 rounded-[10px] bg-obr-bg px-3 ring-1 ring-obr-text/15 ring-inset placeholder:text-obr-text-disabled focus:ring-2 focus:ring-obr-primary focus:outline-none"
      />
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {after && (
        <section aria-label="What happens" className="flex flex-col text-xs">
          <span className="pb-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">What happens</span>
          {lit.length === 0 && ending.length === 0 && staying.length === 0 && <span className="text-obr-text-secondary">Nothing is lit or timed here.</span>}
          {lit.map((l) => {
            const next = after.lights.find((x) => x.id === l.id);
            const left = next && next.status === "lit" ? remaining(next, now) : 0;
            return (
              <div key={l.id} className="flex justify-between gap-2 border-b border-obr-text/10 py-1">
                <span className="truncate">
                  {ICONS[l.kind]} {LIGHT_KINDS[l.kind].label} · {props.names.get(l.tokenId) ?? l.carrier}
                  {props.lights.paused && <span className="text-obr-text-secondary"> (paused)</span>}
                </span>
                <span className={`shrink-0 font-mono tabular-nums ${left === 0 ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                  {formatRemaining(remaining(l, now))} → {left === 0 ? "out" : formatRemaining(left)}
                </span>
              </div>
            );
          })}
          {ending.map((e) => (
            <div key={e.id} className="flex justify-between gap-2 border-b border-obr-text/10 py-1">
              <span className="truncate">
                {e.name}
                {holder(e.holder)}
              </span>
              <span className="shrink-0 text-red-700 dark:text-red-300">ends</span>
            </div>
          ))}
          {staying.length > 0 && (
            <div className="flex justify-between gap-2 py-1">
              <span className="truncate">{staying.map((e) => e.name).join(", ")}</span>
              <span className="shrink-0 text-obr-text-secondary">stay (focus, ongoing)</span>
            </div>
          )}
        </section>
      )}
      <div className="mt-auto flex justify-end gap-1.5">
        <button type="button" className="h-8 rounded-full bg-obr-bg px-4 text-xs font-medium hover:bg-obr-text/10" onClick={props.close}>
          Cancel
        </button>
        <button type="submit" className="h-8 rounded-full bg-obr-primary px-4 text-xs font-medium text-obr-primary-contrast">
          {ms === null ? "Time passes" : `Pass ${text.trim()}`}
        </button>
      </div>
    </form>
  );
};

export default TimeSheet;
