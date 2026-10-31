import { useState, type FormEvent, type ReactNode } from "react";

import Confirm from "./Confirm";
import { FOCUS } from "./CrawlBar";
import Loading from "./Loading";
import Segmented from "./Segmented";
import { useLights, type LightChange } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import {
  LIGHT_KINDS,
  MAX_NOTE,
  burnedOut,
  editNote,
  formatRemaining,
  lightStatus,
  low,
  parseClockEntry,
  parseTimeEntry,
  pause,
  putAllOut,
  putOut,
  refillOil,
  relight,
  remaining,
  removeAll,
  removeLight,
  resume,
  setLightingRule,
  setRelightRule,
  setRemaining,
  shiningCount,
  timePasses,
  toggleShutter,
  type Light,
  type LightKind,
} from "../lights";

// The Light Tracker (docs/design.md, Torchlight merge; mockups lt-*): every
// light timer, the party's light, Time passes, Put lights out, Pause, and
// the two p. 84 rules. GM only, inside the panel like Settings. Lights start
// on tokens (a row's menu: Give torch), so there are no + buttons here.
// `names`: token id → its name on the open map (a light off the map shows
// the name it was lit with).
const LightTracker = ({ names }: { names: Map<string, string> }) => {
  const { loaded, lights: s, change } = useLights();
  const now = useNow();
  if (!loaded) return <Loading />;
  const status = lightStatus(s, now);
  const anyLit = s.lights.some((l) => l.status === "lit");

  return (
    <div className="flex flex-col gap-3 pb-3 text-sm">
      <div className="flex items-stretch gap-2">
        <Banner status={status} count={shiningCount(s, now)} paused={s.paused} />
        <button
          type="button"
          className={`shrink-0 rounded-[10px] px-3 font-medium ring-1 ring-obr-text/15 ring-inset hover:bg-obr-text/10 ${FOCUS}`}
          onClick={() => (s.paused ? change("Resume lights", resume) : change("Pause lights", pause))}
        >
          {s.paused ? "▶ Resume" : "❚❚ Pause"}
        </button>
      </div>

      <TimePasses change={change} />

      <button
        type="button"
        disabled={!anyLit}
        className={`h-9 rounded-[10px] bg-red-700 font-medium text-white disabled:opacity-40 ${FOCUS}`}
        onClick={() => change("Put lights out", putAllOut, { toast: true })}
      >
        Put lights out
      </button>

      {s.lights.map((l) => (
        <LightCard key={l.id} light={l} name={names.get(l.tokenId) ?? l.carrier} now={now} paused={s.paused} change={change} />
      ))}
      {s.lights.length > 0 && (
        <div className="-mt-1">
          <Confirm
            label="Remove all lights"
            question={`Remove all ${s.lights.length} lights?`}
            action="Remove"
            onConfirm={() => change("Remove all lights", removeAll, { toast: true })}
          />
        </div>
      )}

      <section className="flex flex-col gap-2 rounded-xl bg-obr-bg px-3 py-3 ring-1 ring-obr-text/10 ring-inset">
        <h3 className="text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">Lighting a second light (p. 84)</h3>
        <Segmented
          label="Lighting a second light"
          name="lighting-rule"
          value={s.lightingRule}
          options={[
            ["rideAlong", "Ride along"],
            ["separate", "Separate timers"],
          ]}
          onChange={(rule) => change("Lighting rule", (x) => setLightingRule(x, rule))}
        />
        <Rules
          rows={[
            ["Ride along", "A light lit while another is burning joins that timer and goes out with it (p. 84). Campfires keep their own 8 hours."],
            ["Separate timers", "Every light keeps its own full timer."],
          ]}
        />
        <h3 className="pt-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">Putting a light back on</h3>
        <Segmented
          label="Putting a light back on"
          name="relight-rule"
          value={s.relightRule}
          options={[
            ["resume", "Resume its time"],
            ["lightingRule", "Treat as newly lit"],
          ]}
          onChange={(rule) => change("Relight rule", (x) => setRelightRule(x, rule))}
        />
        <Rules
          rows={[
            ["Resume its time", "A light that was put out picks up where it left off: 31:00 left stays 31:00."],
            [
              "Treat as newly lit",
              "It follows the lighting rule above, like any light being lit. With Ride along and another light burning it joins that timer, so 31:00 left could become 12:00.",
            ],
          ]}
        />
        <p className="text-xs text-obr-text-secondary">Manual fixes: click a light's time to correct it; burned-out lights relight as the same light.</p>
      </section>
    </div>
  );
};

const Banner = ({ status, count, paused }: { status: "none" | "lit" | "dark"; count: number; paused: boolean }) => {
  const pausedNote = paused ? " · paused" : "";
  if (status === "none")
    return (
      <p className="flex flex-1 items-center rounded-[10px] bg-obr-bg px-3 py-2 text-obr-text-secondary">
        No lights yet. Give one from a row's menu (⋯ → Give torch).
      </p>
    );
  if (status === "lit")
    return (
      <p role="status" className="flex flex-1 items-center rounded-[10px] bg-amber-500/15 px-3 py-2 font-medium text-amber-800 dark:text-amber-300">
        Party has light · {count} shining{pausedNote}
      </p>
    );
  return (
    <p role="status" className="flex-1 rounded-[10px] bg-red-600/15 px-3 py-2 text-red-800 dark:text-red-200">
      <span className="font-semibold">No light: total darkness</span> (p. 84). Disadvantage on tasks that need sight.{pausedNote}
    </p>
  );
};

// A text field only (the toolkit's way): 10m, 1h, 1:30, 90.
export const TimePasses = ({ change, compact = false }: { change: LightChange; compact?: boolean }) => {
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ms = parseTimeEntry(text);
    if (ms === null) return setSaid("Try 10m, 1h, 1:30 or 90 (minutes), up to 24 hours.");
    change(`Time passes ${text.trim()}`, (s, now) => timePasses(s, now, ms));
    setSaid(`${text.trim()} passed`);
    setText("");
  };
  return (
    <form className="flex flex-col gap-1" onSubmit={submit}>
      <div className="flex gap-2">
        <input
          aria-label="Time passes"
          value={text}
          placeholder={compact ? "10m" : "10m, 1h, 1:30"}
          onChange={(e) => {
            setText(e.target.value);
            setSaid("");
          }}
          className="h-9 min-w-0 flex-1 rounded-[10px] bg-obr-bg px-3 ring-1 ring-obr-text/15 ring-inset placeholder:text-obr-text-disabled focus:ring-2 focus:ring-obr-primary focus:outline-none"
        />
        <button type="submit" className={`h-9 shrink-0 rounded-[10px] bg-obr-primary px-3 font-medium text-obr-primary-contrast ${FOCUS}`}>
          Time passes
        </button>
      </div>
      {said && (
        <span role="status" className="text-xs text-obr-text-secondary">
          {said}
        </span>
      )}
    </form>
  );
};

export const ICONS: Record<LightKind, string> = { torch: "🔥", lantern: "🏮", lightSpell: "✨", campfire: "🏕️" };

const LightCard = (props: { light: Light; name: string; now: number; paused: boolean; change: LightChange }) => {
  const { light: l, name, now, change } = props;
  const [editing, setEditing] = useState(false);
  const [settingTime, setSettingTime] = useState(false);
  const kind = LIGHT_KINDS[l.kind];
  const label = kind.label.toLowerCase();
  const out = burnedOut(l, now);
  const lit = l.status === "lit" && !out;
  const left = remaining(l, now);
  const full = kind.minutes * 60_000;
  const lantern = l.kind === "lantern";
  const state = out ? "burned out" : !lit ? "out" : l.shuttered ? "shuttered" : props.paused ? "paused" : kind.range;
  const on = (what: string, fn: Parameters<LightChange>[1], opts?: { toast?: boolean }) => () => change(`${what} ${label}`, fn, opts);

  return (
    <article
      aria-label={`${kind.label} · ${name}`}
      className="flex flex-col gap-2 rounded-xl bg-obr-bg px-3 py-3 ring-1 ring-obr-text/10 ring-inset"
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg ${lit && !l.shuttered ? "" : "opacity-50 grayscale"}`} aria-hidden>
          {ICONS[l.kind]}
        </span>
        <span className={`flex min-w-0 flex-1 flex-col ${lit ? "" : "text-obr-text-secondary"}`}>
          <span className="truncate font-medium">
            {kind.label}
            {name && <span className="text-amber-700 dark:text-amber-300"> · {name}</span>}
          </span>
          <span className="text-xs text-obr-text-secondary">{state}</span>
        </span>
        {settingTime ? (
          <SetTime
            initial={formatRemaining(left)}
            close={() => setSettingTime(false)}
            save={(ms) => change(`Set ${label} time`, (s, t) => setRemaining(s, t, l.id, ms))}
          />
        ) : (
          <button
            type="button"
            title="Click to correct the time"
            aria-label={`Time left ${formatRemaining(left)}. Correct it`}
            className={`rounded-md px-1 font-mono text-2xl font-semibold tabular-nums hover:bg-obr-text/10 ${
              lit ? (low(l, now) ? "text-red-600 dark:text-red-400" : "") : "text-obr-text-secondary"
            } ${FOCUS}`}
            onClick={() => setSettingTime(true)}
          >
            {formatRemaining(left)}
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-obr-text/10" aria-hidden>
        <div className={`h-full rounded-full ${lit ? "bg-amber-400" : "bg-amber-400/50"}`} style={{ width: `${(left / full) * 100}%` }} />
      </div>
      {l.note && !editing && <p className="text-xs text-obr-text-secondary">{l.note}</p>}
      {editing ? (
        <EditNote
          initial={l.note}
          close={() => setEditing(false)}
          save={(note) => change(`Note on ${label}`, (s, t) => editNote(s, t, l.id, note))}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {lit && <Small onClick={on("Put out", (s, t) => putOut(s, t, l.id))}>Put out</Small>}
          {!lit && (
            <Small primary onClick={on(out ? "Relight" : "Resume", (s, t) => relight(s, t, l.id))}>
              {out ? "Relight" : "Resume"}
            </Small>
          )}
          {lantern && !out && <Small onClick={on(l.shuttered ? "Open" : "Shutter", (s, t) => toggleShutter(s, t, l.id))}>{l.shuttered ? "Open shutter" : "Shutter"}</Small>}
          {lantern && <Small onClick={on("Refill", (s, t) => refillOil(s, t, l.id))}>Refill oil</Small>}
          <Small onClick={() => setEditing(true)}>Edit</Small>
          {!lit && <Small onClick={on("Remove", (s, t) => removeLight(s, t, l.id), { toast: true })}>Remove</Small>}
        </div>
      )}
    </article>
  );
};

const Small = ({ primary = false, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    className={`h-7 rounded-md px-2.5 text-xs font-medium ${
      primary ? "bg-obr-primary text-obr-primary-contrast" : "ring-1 ring-obr-text/15 ring-inset hover:bg-obr-text/10"
    } ${FOCUS}`}
    onClick={onClick}
  >
    {children}
  </button>
);

// The carrier is the token (its name follows it), so only the note edits.
const EditNote = ({ initial, close, save }: { initial: string; close: () => void; save: (note: string) => void }) => {
  const [note, setNote] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save(note);
        close();
      }}
    >
      <textarea
        aria-label="Note"
        autoFocus
        value={note}
        maxLength={MAX_NOTE}
        placeholder="Note"
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
        className="resize-none rounded-[10px] bg-obr-paper px-3 py-2 ring-1 ring-obr-text/15 ring-inset placeholder:text-obr-text-disabled focus:ring-2 focus:ring-obr-primary focus:outline-none"
      />
      <div className="flex justify-end gap-1.5">
        <Small onClick={close}>Cancel</Small>
        <button type="submit" className={`h-7 rounded-md bg-obr-primary px-2.5 text-xs font-medium text-obr-primary-contrast ${FOCUS}`}>
          Save
        </button>
      </div>
    </form>
  );
};

// Correcting a light's time, typed like the countdown (42:15) or 30m.
const SetTime = ({ initial, close, save }: { initial: string; close: () => void; save: (ms: number) => void }) => {
  const [text, setText] = useState(initial);
  const ms = parseClockEntry(text);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (ms === null) return;
        save(ms);
        close();
      }}
    >
      <input
        aria-label="Time left"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        onBlur={close}
        aria-invalid={ms === null}
        className="h-9 w-24 rounded-md bg-obr-paper px-2 text-right font-mono text-lg ring-1 ring-obr-text/15 ring-inset focus:ring-2 focus:ring-obr-primary focus:outline-none aria-invalid:ring-red-600"
      />
    </form>
  );
};

const Rules = ({ rows }: { rows: [string, string][] }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
    {rows.map(([term, text]) => (
      <div key={term} className="contents">
        <dt className="font-medium">{term}</dt>
        <dd className="text-obr-text-secondary">{text}</dd>
      </div>
    ))}
  </dl>
);

export default LightTracker;
