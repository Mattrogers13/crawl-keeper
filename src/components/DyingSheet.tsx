// The GM's Dying sheet, over the list: on the dying character's turn they
// roll 1d4 + CON (at least 1) for their death timer (p. 89), or the table
// rolled and the GM types it. Opened by ▶ (or the notices' Roll the timer)
// when they were marked dying off their turn, or by row menu → Dying… on
// their own turn. One undo step; everyone hears it.
import { useEffect, useRef, useState, type FormEvent } from "react";

import { FOCUS } from "./CrawlBar";
import type { EffectsChange } from "./Effects";
import { ID } from "../constants";
import { cryptoRand, rollDie } from "../crawl";
import { sayDeath } from "../deathNotices";
import { deathTimer, newEffectId, ROUNDS_MAX, startDying } from "../effects";
import { readSession, writeSession } from "../storage";
import { errorMessage } from "../utils";

const CONS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const conKey = (holder: string) => `${ID}/con/${holder}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

// The d4 for the timer: crypto here (Dice+ when it's on: diceRoller.ts).
export type RollD4 = () => Promise<number>;
const localD4: RollD4 = async () => rollDie(4, cryptoRand);

const DyingSheet = (props: {
  holder: string;
  name: string;
  change: EffectsChange;
  close: () => void;
  // Rolled (else `close`); from ▶ the turn then moves on.
  done?: () => void;
  // From ▶: move on without the timer (asked again on their next turn).
  skip?: () => void;
  rollD4?: RollD4;
}) => {
  const { holder, name } = props;
  const [con, setCon] = useState(() => {
    const n = Number(readSession(conKey(holder)));
    return Number.isInteger(n) && n >= -4 && n <= 4 ? n : 0;
  });
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => formRef.current?.querySelector<HTMLButtonElement>("[data-roll]")?.focus(), []);

  const start = (rounds: number, d4: number | null) => {
    setError("");
    try {
      props.change(`Dying: ${name}`, (s, t) => startDying(s, t, newEffectId, holder, rounds));
    } catch (err) {
      setError(errorMessage(err));
      return;
    }
    writeSession(conKey(holder), String(con));
    void sayDeath({ event: "started", name, rounds, d4, con: d4 === null ? null : con });
    (props.done ?? props.close)();
  };
  const roll = async () => {
    setBusy(true);
    try {
      const d4 = await (props.rollD4 ?? localD4)();
      start(deathTimer(d4, con), d4);
    } finally {
      setBusy(false);
    }
  };
  const set = (ev: FormEvent) => {
    ev.preventDefault();
    const n = Number(typed);
    if (!Number.isInteger(n) || n < 1 || n > ROUNDS_MAX) return setError(`Type the rounds rolled: 1 to ${ROUNDS_MAX}.`);
    start(n, null);
  };

  return (
    <form
      ref={formRef}
      aria-label="Dying"
      className="flex min-h-full flex-col gap-2.5 bg-obr-paper px-1 pt-1 pb-2 text-sm"
      onSubmit={set}
      onKeyDown={(ev) => ev.key === "Escape" && props.close()}
    >
      <div className="flex items-center gap-2">
        <img src="/img/effect-dying.webp" alt="" aria-hidden className="h-5 w-5 rounded-full" />
        <span className="flex-1 font-medium">{name} is dying (0 HP): the death timer</span>
        <button type="button" aria-label="Close" className="rounded-md p-1 text-obr-text-secondary hover:bg-obr-text/10" onClick={props.close}>
          ✕
        </button>
      </div>
      <p className="text-xs text-obr-text-secondary">
        Death timer: 1d4 + CON modifier rounds, at least 1 (p. 89). On each later turn a d20; a natural 20 rises with 1 HP.
      </p>
      <span className="text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">CON modifier</span>
      <div role="group" aria-label="CON modifier" className="flex gap-1">
        {CONS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={con === n}
            className={`h-8 min-w-0 flex-1 rounded-md font-mono text-xs ${con === n ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-bg hover:bg-obr-text/10"} ${FOCUS}`}
            onClick={() => setCon(n)}
          >
            {signed(n)}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-roll
        disabled={busy}
        className={`h-10 rounded-[10px] bg-red-700 font-medium text-white hover:bg-red-600 disabled:opacity-60 ${FOCUS}`}
        onClick={() => void roll()}
      >
        {busy ? "Rolling…" : `Roll 1d4 ${con < 0 ? "−" : "+"} ${Math.abs(con)} CON`}
      </button>
      <div className="flex items-center gap-2 text-xs text-obr-text-secondary">
        <span className="flex-1">Rolled at the table?</span>
        <input
          type="number"
          aria-label="Rounds"
          min={1}
          max={ROUNDS_MAX}
          value={typed}
          placeholder="3"
          onChange={(ev) => {
            setTyped(ev.target.value);
            setError("");
          }}
          className="no-spin h-8 w-14 rounded-md bg-obr-bg px-2 text-right font-mono text-sm text-obr-text focus:ring-2 focus:ring-obr-primary focus:outline-none"
        />
        <button type="submit" className="h-8 rounded-full bg-obr-bg px-3 font-medium text-obr-text hover:bg-obr-text/10">
          Set
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between">
        {props.skip ? (
          <button
            type="button"
            title="Move the turn on without the timer: they're asked again on their next turn"
            className="h-8 rounded-full px-3 text-xs font-medium text-obr-text-secondary hover:bg-obr-text/10 hover:text-obr-text"
            onClick={props.skip}
          >
            Skip for now →
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="h-8 rounded-full bg-obr-bg px-4 text-xs font-medium hover:bg-obr-text/10" onClick={props.close}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default DyingSheet;
