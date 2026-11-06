// The panel's effects (docs/effects.md): chips on rows, the strip of effects
// not on a row, the turn's reminders (focus checks, effects ending), and the
// GM's Add effect form. The rules are in effects.ts; the tracker owns the
// writes (Tracker.tsx's changeEffects).
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";

import { FOCUS } from "./CrawlBar";
import { ChevronIcon, EyeIcon, HiddenIcon } from "./icons";
import { iconOf } from "../effectIcons";
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
    // Hidden from players: a dashed outline and the struck-through eye.
    e.hidden ? "border border-dashed border-current" : ""
  }`;
  const text = chipText(e, t);
  const body = (
    <>
      {e.hidden && <HiddenIcon className="h-3 w-3 shrink-0 opacity-80" />}
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
            className="no-spin h-7 w-14 rounded-md bg-obr-bg px-2 text-right font-mono focus:ring-2 focus:ring-obr-primary focus:outline-none"
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

// --- Effects under a row ----------------------------------------------------
// What an effect line says at its right.
const timeText = (e: Effect, t: Tracker) => {
  const st = statusOf(e, t);
  if (st.state === "ended") return "ended";
  if (e.kind === "focus") return "focus";
  if (e.kind === "until") return "ongoing";
  return st.state === "active" && st.left !== null ? `${st.left} rnd` : "";
};

const lineTone = (e: Effect, t: Tracker) => {
  const st = statusOf(e, t);
  if (st.state === "ended") return "text-obr-text-secondary line-through";
  if (st.state === "active" && st.left === 1) return "text-amber-800 dark:text-amber-300";
  return "";
};

// The icon the map shows for it (src/effectIcons.ts).
const EffectIcon = ({ effect, className = "h-4 w-4" }: { effect: Effect; className?: string }) => (
  <img src={`/img/effect-${iconOf(effect)}.webp`} alt="" aria-hidden className={`${className} shrink-0 rounded-full`} />
);

// One effect under its row: icon, name, time left. The GM clicks it for its
// menu (rounds left, end, remove).
const EffectLine = (props: { effect: Effect; tracker: Tracker; change: EffectsChange | null }) => {
  const { effect: e, tracker: t, change } = props;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const what = describe(e, t);
  const look = `flex h-6 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left text-xs ${lineTone(e, t)} ${
    // Hidden from players: a dashed outline and the struck-through eye.
    e.hidden ? "border border-dashed border-obr-text/40" : ""
  }`;
  const body = (
    <>
      <EffectIcon effect={e} />
      {e.hidden && <HiddenIcon className="h-3 w-3 shrink-0 opacity-80" />}
      <span className="min-w-0 flex-1 truncate">{e.name}</span>
      <span className="shrink-0 font-mono text-[11px] text-obr-text-secondary tabular-nums">{timeText(e, t)}</span>
    </>
  );
  if (!change)
    return (
      <li role="img" aria-label={what} title={what} className={look}>
        {body}
      </li>
    );
  return (
    <li>
      <button
        type="button"
        aria-label={`${what}. Click for actions`}
        title={what}
        className={`${look} hover:bg-obr-text/10 ${FOCUS}`}
        onClick={(ev) => {
          const box = ev.currentTarget.getBoundingClientRect();
          setMenu({ x: box.left + 24, y: box.bottom + 2 });
        }}
      >
        {body}
      </button>
      {menu && <ChipMenu effect={e} tracker={t} x={menu.x} y={menu.y} close={() => setMenu(null)} change={change} />}
    </li>
  );
};

// A row's effects, under it (like the monsters under the GM row). One shows
// as its line; two or more fold to one line (their icons and the soonest
// end), open on the row's turn or when clicked.
export const RowEffects = (props: { effects: Effect[]; tracker: Tracker; change: EffectsChange | null; current: boolean }) => {
  const { effects, tracker: t } = props;
  // The GM's or player's own choice, until the turn comes to or leaves the row.
  const [chosen, setChosen] = useState<boolean | null>(null);
  useEffect(() => setChosen(null), [props.current]);
  if (effects.length === 0) return null;
  const foldable = effects.length > 1;
  const open = !foldable || (chosen ?? props.current);
  const lefts = effects.flatMap((e) => {
    const st = statusOf(e, t);
    return st.state === "active" && st.left !== null ? [st.left] : [];
  });
  const soonest = lefts.length ? Math.min(...lefts) : null;
  const icons = [...new Set(effects.map(iconOf))];
  return (
    <div className="flex flex-col pb-1" aria-label="Effects" role="group">
      {foldable && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Fold the effects" : `Show ${effects.length} effects`}
          className="flex h-6 w-full items-center gap-1.5 px-1.5 text-[11px] text-obr-text-secondary hover:text-obr-text"
          onClick={() => setChosen(!open)}
        >
          <ChevronIcon open={open} />
          {open ? (
            <span className="font-medium tracking-[0.04em] uppercase">Effects · {effects.length}</span>
          ) : (
            <>
              <span>{effects.length} effects</span>
              <span className="flex">
                {icons.slice(0, 4).map((i) => (
                  <img key={i} src={`/img/effect-${i}.webp`} alt="" aria-hidden className="-ml-1 h-4 w-4 rounded-full ring-1 ring-obr-paper first:ml-0" />
                ))}
              </span>
              {soonest !== null && (
                <span className={`ml-auto font-mono tabular-nums ${soonest === 1 ? "text-amber-800 dark:text-amber-300" : ""}`}>next ends {soonest} rnd</span>
              )}
            </>
          )}
        </button>
      )}
      {open && (
        <ul className={`flex flex-col ${foldable ? "ml-[7px] border-l border-obr-text/15 pl-1.5" : ""}`}>
          {effects.map((e) => (
            <EffectLine key={e.id} effect={e} tracker={t} change={props.change} />
          ))}
        </ul>
      )}
    </div>
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

// `with:<id>`: until removed, and ends with that focus (Paralyzed while
// Hold Person lasts).
type DurationChoice = "rounds" | "roll" | "focus" | "until" | `with:${string}`;
const TOP = "__top__";

// One effect in the form, as typed.
type Draft = {
  key: number;
  name: string;
  icon: Condition | null;
  duration: DurationChoice;
  rounds: string;
  dice: Dice;
  countsOn: string;
  hidden: boolean;
};

const draftName = (d: Draft) => d.name.trim() || (d.icon ? CONDITIONS[d.icon].label : "");

// The GM's Add effects sheet, over the list: one or more effects for the
// chosen tokens (each gets each), or free-standing. A condition pill adds
// its effect (or takes it out again); + Custom adds a blank one. One undo
// step for all of them, all or nothing.
export const AddEffect = (props: {
  holders: string[];
  names: Map<string, string>;
  tracker: Tracker;
  effects: Effects;
  change: EffectsChange;
  close: () => void;
}) => {
  const { holders, names, tracker } = props;
  const keys = useRef(0);
  const blank = (icon: Condition | null = null): Draft => ({
    key: keys.current++,
    name: icon ? CONDITIONS[icon].label : "",
    icon,
    duration: "rounds",
    rounds: "1",
    dice: "1d4",
    countsOn: tracker.current ?? TOP,
    hidden: false,
  });
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank()]);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState<Effect | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The newest effect's name takes the keyboard.
  const focusKey = useRef<number | null>(drafts[0].key);
  useEffect(() => {
    if (focusKey.current === null) return;
    formRef.current?.querySelector<HTMLInputElement>(`[data-draft="${focusKey.current}"]`)?.focus();
    focusKey.current = null;
  }, [drafts]);

  const focusAllowed = holders.length > 0;
  const focuses = props.effects.effects.filter((e) => e.kind === "focus");
  const edit = (key: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const drop = (key: number) => setDrafts((ds) => (ds.length > 1 ? ds.filter((d) => d.key !== key) : [blank()]));
  const pick = (c: Condition) => {
    const there = drafts.find((d) => d.icon === c);
    if (there) return drop(there.key);
    // A blank effect takes the pick; else a new one.
    const empty = drafts.find((d) => !d.name.trim() && !d.icon);
    if (empty) return edit(empty.key, { icon: c, name: CONDITIONS[c].label });
    const d = blank(c);
    setDrafts((ds) => [...ds, d]);
  };
  const custom = () => {
    const d = blank();
    focusKey.current = d.key;
    setDrafts((ds) => [...ds, d]);
  };
  const input = (d: Draft, replaceFocus: boolean): NewEffect => {
    const endsWith = d.duration.startsWith("with:") ? d.duration.slice(5) : null;
    return {
      name: d.name,
      icon: d.duration === "focus" ? null : d.icon,
      holders,
      duration:
        d.duration === "rounds"
          ? { kind: "rounds", rounds: Number(d.rounds) }
          : d.duration === "roll"
            ? { kind: "rounds", dice: d.dice }
            : d.duration === "focus"
              ? { kind: "focus" }
              : { kind: "until" },
      countsOn: d.countsOn === TOP ? null : d.countsOn,
      endsWith,
      hidden: d.hidden,
      replaceFocus,
    };
  };
  const named = drafts.map(draftName);
  const what = drafts.length > 2 ? `${drafts.length} effects` : named.map((n) => n || "effect").join(", ");
  const add = (replaceFocus: boolean) => {
    setError("");
    try {
      props.change(holders.length > 1 ? `Add ${what} ×${holders.length}` : `Add ${what}`, (e, t) =>
        drafts.reduce((s, d, i) => {
          try {
            return addEffects(s, t, newEffectId, cryptoRand, input(d, replaceFocus));
          } catch (err) {
            // Which one, when there are several.
            if (err instanceof AlreadyFocusingError || drafts.length === 1) throw err;
            throw new Error(`${named[i] || `Effect ${i + 1}`}: ${errorMessage(err)}`);
          }
        }, e),
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
  const field = "h-7 rounded-md bg-obr-paper px-2 text-xs focus:ring-2 focus:ring-obr-primary focus:outline-none";
  const rows = turnOrder(tracker).filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);
  const focusing = drafts.find((d) => d.duration === "focus");
  return (
    <form
      ref={formRef}
      aria-label="Add effect"
      className="flex min-h-full flex-col gap-2 bg-obr-paper px-1 pt-1 pb-2 text-sm"
      onSubmit={submit}
      onKeyDown={(ev) => ev.key === "Escape" && props.close()}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">Add effects</span>
        <span className="min-w-0 flex-1 truncate text-xs text-obr-text-secondary">{target}</span>
        <button type="button" aria-label="Close" className="rounded-md p-1 text-obr-text-secondary hover:bg-obr-text/10" onClick={props.close}>
          ✕
        </button>
      </div>
      <div role="group" aria-label="Conditions" className="flex flex-wrap gap-1">
        {CONDITION_IDS.filter((c) => c !== "focus").map((c) => {
          const on = drafts.some((d) => d.icon === c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              title={CONDITIONS[c].hint}
              className={`h-6 rounded-full px-2 text-xs ${on ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-bg hover:bg-obr-text/10"}`}
              onClick={() => pick(c)}
            >
              {CONDITIONS[c].label}
            </button>
          );
        })}
        <button type="button" className="h-6 rounded-full bg-obr-bg px-2 text-xs hover:bg-obr-text/10" onClick={custom}>
          + Custom
        </button>
      </div>
      {drafts.map((d, i) => (
        <fieldset
          key={d.key}
          aria-label={named[i] || `Effect ${i + 1}`}
          className="flex flex-col gap-1.5 rounded-[10px] bg-obr-bg p-2 ring-1 ring-obr-text/10 ring-inset"
        >
          <div className="flex items-center gap-1.5">
            <img
              src={`/img/effect-${d.duration === "focus" ? "focus" : (d.icon ?? "custom")}.webp`}
              alt=""
              aria-hidden
              className="h-5 w-5 shrink-0 rounded-full"
            />
            <input
              data-draft={d.key}
              aria-label="Effect name"
              placeholder="Bless, Web, Hold Person…"
              maxLength={NAME_MAX}
              value={d.name}
              onChange={(ev) => edit(d.key, { name: ev.target.value })}
              className={`${field} min-w-0 flex-1 text-sm`}
            />
            <button
              type="button"
              aria-label="Hide from players"
              aria-pressed={d.hidden}
              title={d.hidden ? "Hidden from players; click to show" : "Players see it; click to hide"}
              // Green open eye: players see it. Red struck-through eye: hidden.
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                d.hidden ? "bg-red-600/15 text-red-700 dark:text-red-300" : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
              } hover:brightness-125`}
              onClick={() => edit(d.key, { hidden: !d.hidden })}
            >
              {d.hidden ? <HiddenIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Remove this effect"
              className="flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-obr-text-secondary hover:bg-obr-text/10"
              onClick={() => drop(d.key)}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Duration"
              value={d.duration}
              onChange={(ev) => edit(d.key, { duration: ev.target.value as DurationChoice })}
              className={`${field} ${d.duration.startsWith("with:") ? "min-w-0 flex-1" : "w-[84px] shrink-0"}`}
            >
              <option value="rounds">Rounds</option>
              <option value="roll">Roll</option>
              {focusAllowed && (
                // A caster holds one focus: one per batch.
                <option value="focus" disabled={!!focusing && focusing !== d}>
                  Focus
                </option>
              )}
              <option value="until">Ongoing</option>
              {focuses.map((f) => (
                <option key={f.id} value={`with:${f.id}`}>
                  While {names.get(f.holder!) ?? "a token"}'s {f.name} lasts
                </option>
              ))}
            </select>
            {d.duration === "rounds" && (
              <input
                type="number"
                aria-label="Rounds"
                min={1}
                max={ROUNDS_MAX}
                value={d.rounds}
                onChange={(ev) => edit(d.key, { rounds: ev.target.value })}
                className={`${field} no-spin w-12 shrink-0 text-right font-mono`}
              />
            )}
            {d.duration === "roll" && (
              <select aria-label="Dice" title={holders.length > 1 ? "One roll for all" : undefined} value={d.dice} onChange={(ev) => edit(d.key, { dice: ev.target.value as Dice })} className={`${field} w-[62px] shrink-0`}>
                {DICE_IDS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            )}
            {(d.duration === "rounds" || d.duration === "roll") && (
              <select aria-label="Counts down on" title="Counts down at the start of this turn" value={d.countsOn} onChange={(ev) => edit(d.key, { countsOn: ev.target.value })} className={`${field} min-w-0 flex-1`}>
                {rows.map((e) => (
                  <option key={e.id} value={e.id}>
                    on {names.get(e.id) ?? "GM / Monsters"}
                    {e.id === tracker.current ? " (now)" : ""}
                  </option>
                ))}
                <option value={TOP}>Top of each round</option>
              </select>
            )}
            {d.duration === "until" && <span className="min-w-0 truncate text-[11px] text-obr-text-secondary">until removed; days go in the name</span>}
            {d.duration === "focus" && <span className="min-w-0 truncate text-[11px] text-obr-text-secondary">check each turn (p. 50)</span>}
          </div>
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {asking ? (
        <div role="alertdialog" aria-label="Already focusing" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span>
            {asking.holder ? `${names.get(asking.holder) ?? "That token"} is focusing on ${asking.name}.` : ""} End {asking.name}, focus on{" "}
            {(focusing && draftName(focusing)) || "this"}?
          </span>
          <button type="button" className="h-8 rounded-full bg-obr-primary px-3 font-medium text-obr-primary-contrast" onClick={() => add(true)}>
            End and focus
          </button>
          <button type="button" className="h-8 rounded-full bg-obr-bg px-3 font-medium hover:bg-obr-text/10" onClick={() => setAsking(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-1.5">
          <button type="button" className="h-8 rounded-full bg-obr-bg px-4 text-xs font-medium hover:bg-obr-text/10" onClick={props.close}>
            Cancel
          </button>
          <button type="submit" className="h-8 rounded-full bg-obr-primary px-4 text-xs font-medium text-obr-primary-contrast">
            {drafts.length > 1 ? `Add ${drafts.length} effects` : "Add"}
          </button>
        </div>
      )}
    </form>
  );
};
