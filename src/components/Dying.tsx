// The death timer's line, on the dying character's turn (p. 89): in the
// notices card, and in the prompt ▶ opens when no decision was made yet.
// On each turn after the timer was rolled, and on the last turn (the timer
// runs out: a last chance), the death d20; a 20 rises, and on the last turn
// anything else dies. Stabilized, Healed and Dead any time.
import { deathRollDue, statusOf, type Effect } from "../effects";
import type { Tracker } from "../tracker";

// This turn's decision: the d20 rolled, or "table" (rolled at the table,
// not a 20).
export type DeathDecision = number | "table";
export type DeathActions = {
  roll: (holder: string) => void;
  nat20: (holder: string) => void;
  notTwenty: (holder: string) => void;
  stabilized: (holder: string) => void;
  healed: (holder: string) => void;
  dead: (holder: string) => void;
  rolling: boolean;
};

export const deathKey = (holder: string, t: Tracker) => `${holder}@${t.round}:${t.current}`;

// Does this turn owe a death d20 (a turn after the rolling turn, or the last)?
export const owesDeathRoll = (e: Effect, t: Tracker) =>
  e.icon === "dying" && e.holder !== null && e.holder === t.current && (deathRollDue(e, t) || statusOf(e, t).state === "ended");

export const DyingLine = (props: {
  effect: Effect;
  tracker: Tracker;
  name: string;
  decided: DeathDecision | undefined;
  actions: DeathActions | null;
  big?: boolean;
}) => {
  const { effect: e, tracker: t, name, decided, actions } = props;
  const holder = e.holder!;
  const st = statusOf(e, t);
  const last = st.state === "ended";
  const left = st.state === "active" ? (st.left ?? 0) : 0;
  const owes = owesDeathRoll(e, t) && decided === undefined;
  const button = props.big
    ? "h-9 rounded-full bg-obr-paper px-4 text-sm font-medium hover:bg-obr-text/10 disabled:opacity-50"
    : "h-6 rounded-full bg-obr-paper px-2.5 text-[11px] font-medium hover:bg-obr-text/10 disabled:opacity-50";
  return (
    <div
      role="group"
      aria-label={`${name} dying`}
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[10px] bg-red-600/15 text-red-800 dark:text-red-200 ${
        props.big ? "gap-y-2 p-3 text-sm" : "min-h-7 px-1.5 py-1"
      }`}
    >
      <img src="/img/effect-dying.webp" alt="" aria-hidden className={`${props.big ? "h-6 w-6" : "h-4 w-4"} shrink-0 rounded-full`} />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{name}</span>
        {last ? " is dying · the timer runs out: last chance" : ` is dying · ${left} round${left === 1 ? "" : "s"} left`}
        {decided !== undefined && <span className="font-mono"> · {decided === "table" ? "not a 20" : `d20 ${decided}`}</span>}
        {!last && !deathRollDue(e, t) && <span className="text-obr-text-secondary"> · timer rolled this turn</span>}
      </span>
      {actions && (
        <span className={`flex flex-wrap gap-1 ${props.big ? "w-full" : ""}`}>
          {owes && (
            <>
              <button type="button" disabled={actions.rolling} className={button} onClick={() => actions.roll(holder)}>
                {actions.rolling ? "Rolling…" : "Roll d20"}
              </button>
              <button type="button" className={button} title="Rolled a natural 20 at the table: rises with 1 HP" onClick={() => actions.nat20(holder)}>
                Nat 20
              </button>
              <button
                type="button"
                className={button}
                title={last ? "Rolled at the table, not a 20: the timer is out, they die" : "Rolled at the table, not a 20: still dying"}
                onClick={() => actions.notTwenty(holder)}
              >
                Not a 20
              </button>
            </>
          )}
          <button type="button" className={button} title="DC 15 INT first aid (p. 89): no longer dying, still unconscious" onClick={() => actions.stabilized(holder)}>
            Stabilized
          </button>
          <button type="button" className={button} onClick={() => actions.healed(holder)}>
            Healed
          </button>
          <button
            type="button"
            className={`${button.replace("bg-obr-paper", "bg-red-700").replace("hover:bg-obr-text/10", "hover:bg-red-600")} text-white`}
            onClick={() => actions.dead(holder)}
          >
            Dead
          </button>
        </span>
      )}
    </div>
  );
};

// ▶ on a dying character's turn with no decision yet: decide, then the turn
// moves on (Cancel: stay).
export const DeathPrompt = (props: {
  dying: Effect[];
  tracker: Tracker;
  names: Map<string, string>;
  deathDone: Record<string, DeathDecision>;
  actions: DeathActions;
  close: () => void;
}) => (
  <section
    role="dialog"
    aria-label="Death roll first"
    className="flex min-h-full flex-col gap-3 bg-obr-paper px-1 pt-1 pb-2 text-sm"
    onKeyDown={(ev) => ev.key === "Escape" && props.close()}
  >
    <div className="flex items-center gap-2">
      <span className="flex-1 font-medium">Before the turn moves on</span>
      <button type="button" aria-label="Close" className="rounded-md p-1 text-obr-text-secondary hover:bg-obr-text/10" onClick={props.close}>
        ✕
      </button>
    </div>
    <p className="text-xs text-obr-text-secondary">
      A dying character rolls a d20 on each of their turns: a natural 20 rises with 1 HP (p. 89). On the turn the timer runs out, anything else
      and they die.
    </p>
    {props.dying.map((e) => (
      <DyingLine
        key={e.id}
        effect={e}
        tracker={props.tracker}
        name={props.names.get(e.holder!) ?? "A character"}
        decided={props.deathDone[deathKey(e.holder!, props.tracker)]}
        actions={props.actions}
        big
      />
    ))}
    <div className="mt-auto flex justify-end">
      <button type="button" className="h-8 rounded-full bg-obr-bg px-4 text-xs font-medium hover:bg-obr-text/10" onClick={props.close}>
        Cancel
      </button>
    </div>
  </section>
);
