// The panel's effects (docs/effects.md): chips on rows, the strip of effects
// not on a row, the turn's reminders (focus checks, effects ending), and the
// GM's Add effect form. The rules are in effects.ts; the tracker owns the
// writes (Tracker.tsx's changeEffects).
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";

import { FOCUS } from "./CrawlBar";
import Segmented from "./Segmented";
import { cryptoRand } from "../crawl";
import {
  addEffects,
  AlreadyFocusingError,
  CONDITIONS,
  CONDITION_IDS,
  DICE_IDS,
  endFocus,
  NAME_MAX,
  newEffectId,
  removeEffects,
  ROUNDS_MAX,
  setRoundsLeft,
  statusOf,
  type Condition,
  type Dice,
  type Effect,
  type Effects,
  type NewEffect,
} from "../effects";
import { turnOrder, type Tracker } from "../tracker";
import { errorMessage, notify } from "../utils";

// A change to the effects: a pure change, saved, an undo step named `label`.
// `fn` runs at once, so what the rules refuse throws to the caller.
export type EffectsChange = (label: string, fn: (e: Effects, t: Tracker) => Effects) => void;

// Shown on a chip after the name.
const chipText = (e: Effect, t: Tracker) => {
  const st = statusOf(e, t);
  if (st.state === "ended") return "ended";
  return st.state === "active" && st.left !== null ? `${st.left}` : "";
};

const chipLook = (e: Effect, t: Tracker) => {
  const st = statusOf(e, t);
  if (st.state === "ended") return "bg-obr-text/10 text-obr-text-secondary line-through";
  if (st.state === "active" && st.left === 1) return "bg-amber-500/20 text-amber-800 dark:text-amber-300";
  if (e.kind === "focus") return "bg-obr-primary/20 text-obr-text";
  if (e.icon === "adv") return "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300";
  if (e.icon === "dis") return "bg-red-600/15 text-red-700 dark:text-red-300";
  return "bg-obr-text/10 text-obr-text";
};

// What a chip says in full (its tooltip and label).
export const describe = (e: Effect, t: Tracker, holder?: string) => {
  const st = statusOf(e, t);
  const time =
    st.state === "ended"
      ? "ended"
      : e.kind === "focus"
        ? "while focusing"
        : e.kind === "until"
          ? "until removed"
          : `${st.state === "active" ? st.left : 0} of ${e.rounds} rounds left${e.dice ? ` (${e.dice})` : ""}`;
  const hint = e.icon ? CONDITIONS[e.icon].hint : undefined;
  return [holder ? `${e.name} on ${holder}` : e.name, time, e.hidden ? "hidden from players" : "", hint ?? ""].filter(Boolean).join(" · ");
};

// One effect. The GM clicks it for its menu (rounds left, end, remove).
const Chip = (props: { effect: Effect; tracker: Tracker; holder?: string; change: EffectsChange | null; prefix?: string }) => {
  const { effect: e, tracker: t, change } = props;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const what = describe(e, t, props.holder);
  const look = `inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] leading-none ${chipLook(e, t)} ${
    e.hidden ? "ring-1 ring-obr-text/40 ring-dashed" : ""
  }`;
  const text = chipText(e, t);
  const body = (
    <>
      {e.kind === "focus" && <span aria-hidden>◎</span>}
      <span className="truncate">
        {props.prefix && <span className="text-obr-text-secondary">{props.prefix}: </span>}
        {e.name}
      </span>
      {text && <span className="font-mono tabular-nums">{text}</span>}
    </>
  );
  if (!change)
    return (
      <span role="img" aria-label={what} title={what} className={look}>
        {body}
      </span>
    );
  return (
    <>
      <button
        type="button"
        aria-label={`${what}. Click for actions`}
        title={what}
        className={`${look} hover:ring-1 hover:ring-current ${FOCUS}`}
        onClick={(ev) => {
          const box = ev.currentTarget.getBoundingClientRect();
          setMenu({ x: box.left, y: box.bottom + 2 });
        }}
      >
        {body}
      </button>
      {menu && <ChipMenu effect={e} tracker={t} x={menu.x} y={menu.y} close={() => setMenu(null)} change={change} />}
    </>
  );
};

// The GM's actions for one effect.
const ChipMenu = (props: { effect: Effect; tracker: Tracker; x: number; y: number; close: () => void; change: EffectsChange }) => {
  const { effect: e, close, change } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: props.x, top: props.y });
  const st = statusOf(e, props.tracker);
  const [left, setLeft] = useState(st.state === "active" && st.left !== null ? String(st.left) : "");
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(props.x, window.innerWidth - box.width - 4)),
      top: Math.max(4, Math.min(props.y, window.innerHeight - box.height - 4)),
    });
    ref.current!.querySelector<HTMLElement>("input, [role=menuitem]")?.focus();
  }, [props.x, props.y]);
  useEffect(() => {
    const outside = (ev: PointerEvent) => !ref.current?.contains(ev.target as Node) && close();
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [close]);
  const run = (label: string, fn: (s: Effects, t: Tracker) => Effects) => {
    try {
      change(label, fn);
    } catch (err) {
      notify(errorMessage(err), "WARNING");
    }
    close();
  };
  const saveLeft = (ev: FormEvent) => {
    ev.preventDefault();
    const n = Number(left);
    if (!Number.isInteger(n) || n < 1 || n > ROUNDS_MAX) return;
    run(`Rounds left: ${e.name}`, (s, t) => setRoundsLeft(s, t, e.id, n));
  };
  const item = "px-3 py-2 text-left hover:bg-obr-text/5 focus:bg-obr-text/10 focus:outline-none";
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={e.name}
      style={pos}
      className="fixed z-50 flex min-w-44 flex-col rounded-lg bg-obr-paper py-1 text-sm shadow-xl ring-1 ring-obr-text/10"
      onKeyDown={(ev) => ev.key === "Escape" && close()}
    >
      {e.kind === "rounds" && st.state === "active" && (
        <form className="flex items-center gap-2 px-3 py-1.5" onSubmit={saveLeft}>
          <label className="flex-1 text-xs text-obr-text-secondary" htmlFor={`left-${e.id}`}>
            Rounds left
          </label>
          <input
            id={`left-${e.id}`}
            type="number"
            min={1}
            max={ROUNDS_MAX}
            value={left}
            onChange={(ev) => setLeft(ev.target.value)}
            className="h-7 w-14 rounded-md bg-obr-bg px-2 text-right font-mono focus:ring-2 focus:ring-obr-primary focus:outline-none"
          />
          <button type="submit" className="h-7 rounded-full bg-obr-bg px-3 text-xs font-medium hover:bg-obr-text/10">
            Set
          </button>
        </form>
      )}
      {e.kind === "focus" ? (
        <button type="button" role="menuitem" className={item} onClick={() => run(`End focus: ${e.name}`, (s) => endFocus(s, e.id))}>
          End focus
        </button>
      ) : (
        <button type="button" role="menuitem" className={item} onClick={() => run(`Remove ${e.name}`, (s) => removeEffects(s, [e.id]))}>
          Remove
        </button>
      )}
    </div>
  );
};

// A row's effects, under its name: three, then "+N" to open the rest.
export const RowEffects = (props: { effects: Effect[]; tracker: Tracker; change: EffectsChange | null }) => {
  const [open, setOpen] = useState(false);
  if (props.effects.length === 0) return null;
  const MAX = 3;
  const list = open ? props.effects : props.effects.slice(0, MAX);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1 pt-0.5" aria-label="Effects">
      {list.map((e) => (
        <Chip key={e.id} effect={e} tracker={props.tracker} change={props.change} />
      ))}
      {props.effects.length > MAX && (
        <button
          type="button"
          aria-expanded={open}
          className="h-5 rounded-full px-1.5 text-[11px] text-obr-text-secondary hover:bg-obr-text/10"
          onClick={() => setOpen(!open)}
        >
          {open ? "less" : `+${props.effects.length - MAX}`}
        </button>
      )}
    </span>
  );
};

// Effects not on a row: free-standing ones, and those on tokens that aren't
// in initiative (with the token's name).
export const EffectStrip = (props: { effects: Effect[]; tracker: Tracker; names: Map<string, string>; change: EffectsChange | null }) =>
  props.effects.length === 0 ? null : (
    <section aria-label="Effects" className="flex flex-wrap items-center gap-1 rounded-[14px] bg-obr-bg px-3 py-2 ring-1 ring-obr-text/10 ring-inset">
      <span className="mr-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">Effects</span>
      {props.effects.map((e) => {
        const holder = e.holder === null ? undefined : (props.names.get(e.holder) ?? "a token");
        return <Chip key={e.id} effect={e} tracker={props.tracker} holder={holder} prefix={holder} change={props.change} />;
      })}
    </section>
  );

// The turn's reminders: focus checks due now (p. 50) and effects ending on
// this turn. The GM resolves a failed check here: Lost, or Nat 1 (also a
// critical failure, p. 45). Kept needs nothing: ▶ goes on.
export const Reminders = (props: {
  checks: Effect[];
  ending: Effect[];
  tracker: Tracker;
  names: Map<string, string>;
  change: EffectsChange | null;
  // A check the GM asked for now (Focus check now), and how to dismiss it.
  dismiss?: (id: string) => void;
  extra?: string[];
}) => {
  const { checks, ending, names, change } = props;
  if (checks.length === 0 && ending.length === 0) return null;
  const who = (e: Effect) => (e.holder === null ? "" : (names.get(e.holder) ?? "A token"));
  const lose = (e: Effect, nat1: boolean) => {
    try {
      change!(nat1 ? `Nat 1: ${e.name}` : `Focus lost: ${e.name}`, (s) => endFocus(s, e.id));
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    if (nat1)
      notify(
        `${who(e)}: natural 1, a critical failure (p. 45). A wizard can't cast ${e.name} again until a rest and rolls on the Wizard Mishap table (p. 46); a priest can't until they do penance.`,
        "WARNING",
      );
  };
  const button = "h-7 rounded-full bg-obr-paper px-3 text-xs font-medium hover:bg-obr-text/10";
  return (
    <section aria-label="Reminders" className="flex flex-col gap-1.5 rounded-[14px] bg-obr-primary/10 px-3 py-2 text-xs ring-1 ring-obr-primary/30 ring-inset">
      {checks.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex-1">
            <span className="font-semibold">{who(e)}: focus check</span>, {e.name} (spellcasting check as if casting it)
          </span>
          {change && (
            <span className="flex gap-1">
              <button type="button" className={button} onClick={() => lose(e, false)}>
                Lost
              </button>
              <button type="button" className={button} title="Lost, and a critical failure (p. 45)" onClick={() => lose(e, true)}>
                Nat 1
              </button>
              {props.extra?.includes(e.id) && props.dismiss && (
                <button type="button" aria-label="Dismiss" className={button} onClick={() => props.dismiss!(e.id)}>
                  Kept
                </button>
              )}
            </span>
          )}
        </div>
      ))}
      {ending.map((e) => (
        <div key={e.id}>
          <span className="font-semibold">{e.name}</span>
          {e.holder !== null && ` on ${who(e)}`} ends now
        </div>
      ))}
    </section>
  );
};

type DurationChoice = "rounds" | "roll" | "focus" | "until";
const TOP = "__top__";

// The GM's Add effect form: for the selected rows (one effect each), or
// free-standing. Conditions are quick picks; Focus is a duration.
export const AddEffect = (props: {
  holders: string[];
  names: Map<string, string>;
  tracker: Tracker;
  effects: Effects;
  change: EffectsChange;
  close: () => void;
}) => {
  const { holders, names, tracker } = props;
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<Condition | null>(null);
  const [duration, setDuration] = useState<DurationChoice>("rounds");
  const [rounds, setRounds] = useState("1");
  const [dice, setDice] = useState<Dice>("1d4");
  const [countsOn, setCountsOn] = useState(tracker.current ?? TOP);
  const [endsWith, setEndsWith] = useState("");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState<Effect | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const focusAllowed = holders.length > 0;
  const focuses = props.effects.effects.filter((e) => e.kind === "focus");
  const pick = (c: Condition) => {
    const same = icon === c;
    setIcon(same ? null : c);
    // The name follows the pick while it's blank or another pick's.
    if (!name.trim() || CONDITION_IDS.some((id) => CONDITIONS[id].label === name)) setName(same ? "" : CONDITIONS[c].label);
  };
  const input = (replaceFocus: boolean): NewEffect => ({
    name,
    icon: duration === "focus" ? null : icon,
    holders,
    duration:
      duration === "rounds"
        ? { kind: "rounds", rounds: Number(rounds) }
        : duration === "roll"
          ? { kind: "rounds", dice }
          : { kind: duration },
    countsOn: countsOn === TOP ? null : countsOn,
    endsWith: duration !== "focus" && endsWith ? endsWith : null,
    hidden,
    replaceFocus,
  });
  const add = (replaceFocus: boolean) => {
    setError("");
    try {
      props.change(holders.length > 1 ? `Add ${name.trim() || "effect"} ×${holders.length}` : `Add ${name.trim() || "effect"}`, (e, t) =>
        addEffects(e, t, newEffectId, cryptoRand, input(replaceFocus)),
      );
      props.close();
    } catch (err) {
      if (err instanceof AlreadyFocusingError) setAsking(err.focus);
      else setError(errorMessage(err));
    }
  };
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    add(false);
  };

  const target = holders.length === 0 ? "No token (free-standing)" : holders.map((h) => names.get(h) ?? "a token").join(", ");
  const field = "h-8 rounded-md bg-obr-paper px-2 text-sm focus:ring-2 focus:ring-obr-primary focus:outline-none";
  const label = "text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase";
  const rows = turnOrder(tracker).filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);
  return (
    <form
      aria-label="Add effect"
      className="flex shrink-0 flex-col gap-2 rounded-[14px] bg-obr-bg px-3 py-2.5 text-sm ring-1 ring-obr-text/10 ring-inset"
      onSubmit={submit}
      onKeyDown={(ev) => ev.key === "Escape" && props.close()}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-medium">Add effect</span>
        <span className="truncate text-xs text-obr-text-secondary">{target}</span>
      </div>
      <input
        ref={nameRef}
        aria-label="Effect name"
        placeholder="Bless, Web, Hold Person…"
        maxLength={NAME_MAX}
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        className={field}
      />
      {duration !== "focus" && (
        <div role="group" aria-label="Condition" className="flex flex-wrap gap-1">
          {CONDITION_IDS.filter((c) => c !== "focus").map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={icon === c}
              className={`h-6 rounded-full px-2 text-xs ${icon === c ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-paper hover:bg-obr-text/10"}`}
              onClick={() => pick(c)}
            >
              {CONDITIONS[c].label}
            </button>
          ))}
        </div>
      )}
      <span className={label}>Duration</span>
      <Segmented
        label="Duration"
        name="effect-duration"
        value={duration}
        options={[
          ["rounds", "Rounds"],
          ["roll", "Roll"],
          ...(focusAllowed ? ([["focus", "Focus"]] as [DurationChoice, string][]) : []),
          ["until", "Ongoing"],
        ]}
        onChange={setDuration}
      />
      {duration === "rounds" && (
        <label className="flex items-center gap-2 text-xs text-obr-text-secondary">
          Rounds
          <input
            type="number"
            min={1}
            max={ROUNDS_MAX}
            value={rounds}
            onChange={(ev) => setRounds(ev.target.value)}
            className={`${field} w-16 text-right font-mono`}
          />
        </label>
      )}
      {duration === "roll" && (
        <label className="flex items-center gap-2 text-xs text-obr-text-secondary">
          Roll
          <select value={dice} onChange={(ev) => setDice(ev.target.value as Dice)} className={field}>
            {DICE_IDS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {holders.length > 1 && <span>one roll for all</span>}
        </label>
      )}
      {(duration === "rounds" || duration === "roll") && (
        <label className="flex items-center gap-2 text-xs text-obr-text-secondary">
          Counts down on
          <select value={countsOn} onChange={(ev) => setCountsOn(ev.target.value)} className={`${field} min-w-0 flex-1`}>
            {rows.map((e) => (
              <option key={e.id} value={e.id}>
                {names.get(e.id) ?? "GM / Monsters"}
                {e.id === tracker.current ? " (now)" : ""}
              </option>
            ))}
            <option value={TOP}>Top of each round</option>
          </select>
        </label>
      )}
      {duration === "until" && <p className="text-xs text-obr-text-secondary">Until you remove it. Hours or days: write them in the name (“Cursed, 1d4 days”).</p>}
      {duration === "focus" && <p className="text-xs text-obr-text-secondary">A focus check at the start of each of the caster's turns keeps it (p. 50).</p>}
      {duration !== "focus" && focuses.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-obr-text-secondary">
          Ends with
          <select value={endsWith} onChange={(ev) => setEndsWith(ev.target.value)} className={`${field} min-w-0 flex-1`}>
            <option value="">Nothing</option>
            {focuses.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({names.get(f.holder!) ?? "a token"}'s focus)
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={hidden} onChange={(ev) => setHidden(ev.target.checked)} className="accent-[var(--obr-primary)]" />
        Hide from players
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {asking ? (
        <div role="alertdialog" aria-label="Already focusing" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span>
            {asking.holder ? `${names.get(asking.holder) ?? "That token"} is focusing on ${asking.name}.` : ""} End {asking.name}, focus on{" "}
            {name.trim() || "this"}?
          </span>
          <button type="button" className="h-8 rounded-full bg-obr-primary px-3 font-medium text-obr-primary-contrast" onClick={() => add(true)}>
            End and focus
          </button>
          <button type="button" className="h-8 rounded-full bg-obr-paper px-3 font-medium hover:bg-obr-text/10" onClick={() => setAsking(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-1.5">
          <button type="button" className="h-8 rounded-full bg-obr-paper px-4 text-xs font-medium hover:bg-obr-text/10" onClick={props.close}>
            Cancel
          </button>
          <button type="submit" className="h-8 rounded-full bg-obr-primary px-4 text-xs font-medium text-obr-primary-contrast">
            Add
          </button>
        </div>
      )}
    </form>
  );
};
