// The notices card under the crawl card (layout B, 2026-11-06): what needs
// the GM now always shows (total darkness, focus checks with Lost / Nat 1);
// the rest (effects ending now, lights burned out, effects not on a row)
// folds to one line with a count. Players get the same, read-only, minus
// what's the GM's (darkness and lights are on their own rows).
import { useEffect, useRef, useState } from "react";

import { EffectLine, type EffectsChange } from "./Effects";
import { ChevronIcon } from "./icons";
import { ID } from "../constants";
import { cryptoRand, rollDie } from "../crawl";
import { sayDeath } from "../deathNotices";
import { deathRollDue, endFocus, newEffectId, stabilize, statusOf, stopDying, type Effect } from "../effects";
import { useNow } from "../hooks/useNow";
import { burnedOut, LIGHT_KINDS, type Light } from "../lights";
import type { Tracker } from "../tracker";
import { logEvent } from "../sessionLog";
import { readSession, writeSession } from "../storage";
import { errorMessage, notify } from "../utils";

// Burned-out lights already told (✕, or the turn moved on): the session log
// keeps them, the card lets them go. This tab's, like the undo history.
const SEEN_KEY = `${ID}/lights-seen`;
// One burning-out (a relit lantern that runs dry again is told again).
const outKey = (l: Light) => `${l.id}@${l.spentAt ?? l.endsAt}`;
const readSeen = (): Set<string> => {
  try {
    const ids = JSON.parse(readSession(SEEN_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(-64) : []);
  } catch {
    return new Set();
  }
};

type Line = { key: string; short: string; warn: boolean; node: React.ReactNode };

const Notices = (props: {
  dark: boolean;
  checks: Effect[];
  // A check the GM asked for now (Focus check now), and how to dismiss it.
  extra: string[];
  dismiss: (id: string) => void;
  ending: Effect[];
  // The GM's lights (burned-out ones are told here); none for players.
  lights: Light[];
  loose: Effect[];
  tracker: Tracker;
  names: Map<string, string>;
  change: EffectsChange | null;
  // Death timers on this map (p. 89), and the GM's Mark dead for a row whose
  // timer ran out; the d20 (crypto, or Dice+ when it's on).
  dying?: Effect[];
  markDead?: ((id: string) => void) | null;
  rollD20?: () => Promise<number>;
}) => {
  const { checks, names, change } = props;
  // The death d20 rolled this turn, per holder (one roll a turn).
  const [deathRolls, setDeathRolls] = useState<Record<string, number>>({});
  const [rolling, setRolling] = useState(false);
  const [open, setOpen] = useState(false);
  const now = useNow();
  const [seen, setSeen] = useState(readSeen);
  const spent = props.lights.filter((l) => burnedOut(l, now) && !seen.has(outKey(l)));
  const letGo = (ids: string[]) => {
    if (ids.length === 0) return;
    setSeen((old) => {
      const next = new Set([...old, ...ids]);
      writeSession(SEEN_KEY, JSON.stringify([...next].slice(-64)));
      return next;
    });
  };
  // When the turn moves on, what burned out before it has been seen.
  const turn = `${props.tracker.round}:${props.tracker.current}`;
  const lastTurn = useRef(turn);
  const spentNow = useRef(spent);
  spentNow.current = spent;
  useEffect(() => {
    if (lastTurn.current === turn) return;
    lastTurn.current = turn;
    letGo(spentNow.current.map(outKey));
  }, [turn]);
  const who = (e: Effect) => (e.holder === null ? "" : (names.get(e.holder) ?? "A token"));
  const lose = (e: Effect, nat1: boolean) => {
    try {
      change!(nat1 ? `Nat 1: ${e.name}` : `Focus lost: ${e.name}`, (s) => endFocus(s, e.id));
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    logEvent(`${who(e)} lost focus on ${e.name}${nat1 ? " (natural 1, a critical failure)" : ""}.`, "focus");
    if (nat1)
      notify(
        `${who(e)}: natural 1, a critical failure (p. 45). A wizard can't cast ${e.name} again until a rest and rolls on the Wizard Mishap table (p. 46); a priest can't until they do penance.`,
        "WARNING",
      );
  };

  // The rest, foldable.
  const more: Line[] = [
    ...props.ending.map((e) => ({
      key: `end-${e.id}`,
      short: `${e.name} ends`,
      warn: true,
      node: (
        <div className="flex min-h-6 items-center gap-1.5 px-1.5 text-amber-800 dark:text-amber-300">
          <span className="w-4 text-center" aria-hidden>
            ⏱
          </span>
          <span>
            <span className="font-semibold">{e.name}</span>
            {e.holder !== null && ` on ${who(e)}`} ends now
          </span>
        </div>
      ),
    })),
    ...spent.map((l) => ({
      key: `light-${l.id}`,
      short: `${LIGHT_KINDS[l.kind].label} out`,
      warn: true,
      node: (
        <div className="flex min-h-6 items-center gap-1.5 px-1.5 text-amber-800 dark:text-amber-300">
          <span className="w-4 text-center" aria-hidden>
            🔥
          </span>
          <span className="min-w-0 flex-1">
            {LIGHT_KINDS[l.kind].label} · {names.get(l.tokenId) ?? l.carrier} burned out
          </span>
          <button
            type="button"
            aria-label={`Dismiss: ${LIGHT_KINDS[l.kind].label} · ${names.get(l.tokenId) ?? l.carrier} burned out`}
            title="Dismiss (the session log keeps it)"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-obr-text-secondary hover:bg-obr-text/10"
            onClick={() => letGo([outKey(l)])}
          >
            ✕
          </button>
        </div>
      ),
    })),
    ...props.loose.map((e) => ({
      key: `fx-${e.id}`,
      short: e.name,
      warn: false,
      node: (
        <ul>
          <EffectLine
            effect={e}
            tracker={props.tracker}
            change={change}
            holder={e.holder === null ? undefined : (names.get(e.holder) ?? "a token")}
            tag={e.holder === null ? "no token" : (names.get(e.holder) ?? "a token")}
          />
        </ul>
      ),
    })),
  ];
  // Death timers: on the holder's turn, or the turn the timer ran out.
  const t = props.tracker;
  const dyingNow = (props.dying ?? []).flatMap((e) => {
    if (e.holder === null) return [];
    const st = statusOf(e, t);
    if (st.state === "ended") return [{ e, ended: true, left: 0 }];
    return st.state === "active" && t.current === e.holder ? [{ e, ended: false, left: st.left ?? 0 }] : [];
  });
  const rollKey = (holder: string) => `${holder}@${turn}`;
  const rises = (holder: string, name: string) => {
    try {
      change!(`Rises: ${name}`, (s) => stopDying(s, holder));
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    void sayDeath({ event: "rises", name });
  };
  const rollDeath = async (holder: string, name: string) => {
    setRolling(true);
    try {
      const value = await (props.rollD20 ?? (async () => rollDie(20, cryptoRand)))();
      setDeathRolls((r) => ({ ...r, [rollKey(holder)]: value }));
      void sayDeath({ event: "rolled", name, value });
      if (value === 20) rises(holder, name);
    } finally {
      setRolling(false);
    }
  };
  const stop = (holder: string, name: string, event: "stabilized" | "healed") => {
    try {
      change!(event === "healed" ? `Healed: ${name}` : `Stabilized: ${name}`, (s, tr) =>
        event === "healed" ? stopDying(s, holder) : stabilize(s, tr, newEffectId, holder),
      );
    } catch (err) {
      notify(errorMessage(err), "WARNING");
      return;
    }
    void sayDeath({ event, name });
  };

  if (!props.dark && checks.length === 0 && more.length === 0 && dyingNow.length === 0) return null;
  // One alone shows as itself; two or more fold.
  const folds = more.length > 1;
  const button = "h-6 rounded-full bg-obr-paper px-2.5 text-[11px] font-medium hover:bg-obr-text/10";
  return (
    <section aria-label="Notices" className="flex shrink-0 flex-col gap-0.5 rounded-[14px] bg-obr-bg px-1.5 py-1.5 text-xs ring-1 ring-obr-text/10 ring-inset">
      {props.dark && (
        <p className="rounded-[10px] bg-red-600/15 px-2 py-1 text-red-800 dark:text-red-200">
          <span className="font-semibold">Total darkness</span> (p. 84): disadvantage on tasks that need sight, for anyone not darkness-adapted.
        </p>
      )}
      {dyingNow.map(({ e, ended, left }) => {
        const holder = e.holder!;
        const name = names.get(holder) ?? "A character";
        const rolled = deathRolls[rollKey(holder)];
        const due = deathRollDue(e, t);
        return (
          <div
            key={e.id}
            role="group"
            aria-label={`${name} dying`}
            className="flex min-h-7 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[10px] bg-red-600/15 px-1.5 py-1 text-red-800 dark:text-red-200"
          >
            <img src="/img/effect-dying.webp" alt="" aria-hidden className="h-4 w-4 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1">
              {ended ? (
                <>
                  <span className="font-semibold">{name}</span>'s death timer ran out
                </>
              ) : (
                <>
                  <span className="font-semibold">{name}</span> is dying · {left} round{left === 1 ? "" : "s"} left
                  {rolled !== undefined && <span className="font-mono"> · d20 {rolled}</span>}
                  {!due && <span className="text-obr-text-secondary"> · timer rolled this turn</span>}
                </>
              )}
            </span>
            {change && ended && props.markDead && (
              <button type="button" className={`${button} bg-red-700 text-white hover:bg-red-600`} onClick={() => props.markDead!(holder)}>
                Mark dead
              </button>
            )}
            {change && !ended && (
              <span className="flex flex-wrap gap-1">
                {due && rolled === undefined && (
                  <>
                    <button type="button" disabled={rolling} className={button} onClick={() => void rollDeath(holder, name)}>
                      {rolling ? "Rolling…" : "Roll d20"}
                    </button>
                    <button type="button" className={button} title="Rolled a natural 20 at the table: rises with 1 HP" onClick={() => rises(holder, name)}>
                      Nat 20
                    </button>
                  </>
                )}
                <button type="button" className={button} title="DC 15 INT first aid (p. 89): no longer dying, still unconscious" onClick={() => stop(holder, name, "stabilized")}>
                  Stabilized
                </button>
                <button type="button" className={button} onClick={() => stop(holder, name, "healed")}>
                  Healed
                </button>
              </span>
            )}
          </div>
        );
      })}
      {checks.map((e) => (
        <div key={e.id} className="flex min-h-7 flex-wrap items-center gap-x-1.5 gap-y-1 px-1.5">
          <img src="/img/effect-focus.webp" alt="" aria-hidden className="h-4 w-4 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1" title="A spellcasting check as if casting it (p. 50)">
            <span className="font-semibold">{who(e)}</span>: focus check, {e.name}
          </span>
          {change && (
            <span className="flex gap-1">
              <button type="button" className={button} onClick={() => lose(e, false)}>
                Lost
              </button>
              <button type="button" className={button} title="Lost, and a critical failure (p. 45)" onClick={() => lose(e, true)}>
                Nat 1
              </button>
              {props.extra.includes(e.id) && (
                <button type="button" aria-label="Dismiss" className={button} onClick={() => props.dismiss(e.id)}>
                  Kept
                </button>
              )}
            </span>
          )}
        </div>
      ))}
      {folds && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Fold the notices" : `Show ${more.length} more notices`}
          className="flex min-h-6 w-full items-center gap-1.5 px-1.5 text-left text-obr-text-secondary hover:text-obr-text"
          onClick={() => setOpen(!open)}
        >
          <span className="flex w-4 justify-center">
            <ChevronIcon open={open} />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {open
              ? `${more.length} more`
              : [`${more.length} more`, ...more.map((m) => m.short)].map((t, i) => (
                  <span key={i} className={i > 0 && more[i - 1].warn ? "text-amber-800 dark:text-amber-300" : ""}>
                    {i > 0 && " · "}
                    {t}
                  </span>
                ))}
          </span>
          {!open && more.some((m) => m.warn) && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
              {more.filter((m) => m.warn).length}
            </span>
          )}
        </button>
      )}
      {(!folds || open) && more.map((m) => <div key={m.key}>{m.node}</div>)}
    </section>
  );
};

export default Notices;
