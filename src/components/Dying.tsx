// The death timer's line, on the dying character's turn (p. 89): in the
// notices card, and in the prompt ▶ opens when no decision was made yet.
// On each turn after the timer was rolled, and on the last turn (the timer
// runs out: a last chance), the death d20; a 20 rises, and on the last turn
// anything else dies. Stabilized, Healed and Dead any time.
import { deathRollDue, statusOf, type Effect } from "../effects";
import type { Tracker } from "../tracker";

// This turn's decision: the d20 rolled, "failed" (rolled at the table, not
// a 20), "skip" (▶'s prompt: move on, decide on their next turn) or
// "other" (stabilized, healed, dead).
export type DeathDecision = number | "failed" | "skip" | "other";
export type DeathActions = {
  roll: (holder: string) => void;
  nat20: (holder: string) => void;
  failed: (holder: string) => void;
  stabilized: (holder: string) => void;
  healed: (holder: string) => void;
  dead: (holder: string) => void;
  rolling: boolean;
};

const DECIDED: Record<string, string> = { failed: "failed", skip: "skipped" };
const decidedText = (d: DeathDecision | undefined) => (typeof d === "number" ? `d20 ${d}` : d === undefined ? undefined : DECIDED[d]);

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
        {decidedText(decided) && <span className="font-mono"> · {decidedText(decided)}</span>}
        {!last && !deathRollDue(e, t) && <span className="text-obr-text-secondary"> · timer rolled this turn</span>}
      </span>
      {actions && (
        <span className={`flex flex-wrap gap-1 ${props.big ? "w-full" : ""}`}>
          {owes && (
            <button type="button" className={button} title={last ? "Rolled at the table, not a 20: the timer is out, they die" : "Rolled at the table, not a 20: still dying"} onClick={() => actions.failed(holder)}>
              Failed
            </button>
          )}
          <button type="button" className={button} title="DC 15 INT first aid (p. 89): no longer dying, still unconscious" onClick={() => actions.stabilized(holder)}>
            Stabilized
          </button>
          <button type="button" className={button} onClick={() => actions.healed(holder)}>
            Healed
          </button>
          {owes && (
            <>
              <button type="button" className={button} title="Rolled a natural 20 at the table: rises with 1 HP" onClick={() => actions.nat20(holder)}>
                Nat 20
              </button>
              <button type="button" disabled={actions.rolling} className={button} onClick={() => actions.roll(holder)}>
                {actions.rolling ? "Rolling…" : "Roll d20"}
              </button>
            </>
          )}
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

// ▶ on a dying character's turn with no decision yet. The buttons go by how
// often each happens: 19 death d20s in 20 fail, so Failed is the big one;
// an ally's first aid or healing next; a natural 20 after (p. 89). Skip for
// now moves the turn on undecided (a lost roll never stops the game); ✕ or
// Escape stays on the turn, and ▶ opens the prompt again.
export const DeathPrompt = (props: {
  dying: Effect[];
  tracker: Tracker;
  names: Map<string, string>;
  actions: DeathActions;
  skip: (holder: string) => void;
  close: () => void;
}) => (
  <section
    role="dialog"
    aria-label="Death roll first"
    className="flex min-h-full flex-col gap-4 bg-obr-paper px-1 pt-1 pb-2 text-sm"
    onKeyDown={(ev) => ev.key === "Escape" && props.close()}
  >
    {props.dying.map((e) => (
      <DeathCard
        key={e.id}
        effect={e}
        tracker={props.tracker}
        name={props.names.get(e.holder!) ?? "A character"}
        actions={props.actions}
        skip={props.skip}
        close={props.close}
      />
    ))}
  </section>
);

const CHOICE = "flex flex-col items-start rounded-xl bg-obr-bg px-3 py-2 text-left hover:bg-obr-text/10 disabled:opacity-50";

const DeathCard = (props: {
  effect: Effect;
  tracker: Tracker;
  name: string;
  actions: DeathActions;
  skip: (holder: string) => void;
  close: () => void;
}) => {
  const { effect: e, tracker: t, name, actions } = props;
  const holder = e.holder!;
  const st = statusOf(e, t);
  const last = st.state === "ended";
  const left = st.state === "active" ? (st.left ?? 0) : 0;
  const choice = (label: string, hint: string, act: () => void, disabled = false) => (
    <button type="button" aria-label={label} disabled={disabled} className={CHOICE} onClick={act}>
      <span className="font-medium">{label}</span>
      <span className="text-xs text-obr-text-secondary">{hint}</span>
    </button>
  );
  return (
    <div role="group" aria-label={`${name}'s death roll`} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <img src="/img/effect-dying.webp" alt="" aria-hidden className="h-6 w-6 shrink-0 rounded-full" />
        <span className="flex-1 font-semibold">{last ? `${name}: last chance` : `${name} is dying`}</span>
        <button
          type="button"
          aria-label="Close"
          title="Close: the turn stays; ▶ asks again"
          className="rounded-md p-1 text-obr-text-secondary hover:bg-obr-text/10"
          onClick={props.close}
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-obr-text-secondary">
        {last
          ? "The timer is out. Anything but a natural 20 and they die."
          : `${left} round${left === 1 ? "" : "s"} left · roll a d20 at the table, or here. A natural 20 rises with 1 HP.`}
      </p>
      <button
        type="button"
        aria-label={last ? `Failed · ${name} dies` : "Failed · still dying"}
        title="Rolled at the table, not a 20"
        className={`h-12 w-full rounded-xl text-base font-semibold ${last ? "bg-red-700 text-white hover:bg-red-600" : "bg-obr-primary text-obr-primary-contrast hover:opacity-90"}`}
        onClick={() => actions.failed(holder)}
      >
        {last ? `Failed · ${name} dies` : "Failed · still dying"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        {choice("Stabilized", "an ally's DC 15 INT check", () => actions.stabilized(holder))}
        {choice("Healed", "back on their feet", () => actions.healed(holder))}
        {choice("Nat 20", "rises with 1 HP", () => actions.nat20(holder))}
        {choice(actions.rolling ? "Rolling…" : "Roll d20", "roll it for me", () => actions.roll(holder), actions.rolling)}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          title="Move the turn on without deciding: the timer keeps running; they're asked again on their next turn"
          className="h-8 rounded-full px-3 text-xs font-medium text-obr-text-secondary hover:bg-obr-text/10 hover:text-obr-text"
          onClick={() => props.skip(holder)}
        >
          Skip for now →
        </button>
        {!last && (
          <button type="button" className="h-8 rounded-full px-3 text-xs font-medium text-red-700 hover:bg-red-600/15 dark:text-red-300" onClick={() => actions.dead(holder)}>
            Mark dead
          </button>
        )}
      </div>
    </div>
  );
};
