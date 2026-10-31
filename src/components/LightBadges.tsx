import { ICONS } from "./LightTracker";
import { FOCUS } from "./CrawlBar";
import type { LightChange } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import { LIGHT_KINDS, burnedOut, formatRemaining, low, putOut, relight, remaining, type Light } from "../lights";

// A row's lights (mockups ck-03 to ck-08): one badge each, the icon and the
// time left, or "out" / "spent". The GM clicks one to put it out or back on;
// players see them only.
const LightBadges = ({ lights, change }: { lights: Light[]; change: LightChange | null }) => {
  const now = useNow();
  return (
    <span className="flex shrink-0 gap-1">
      {lights.map((l) => (
        <Badge key={l.id} light={l} now={now} change={change} />
      ))}
    </span>
  );
};

const Badge = ({ light: l, now, change }: { light: Light; now: number; change: LightChange | null }) => {
  const label = LIGHT_KINDS[l.kind].label;
  const spent = burnedOut(l, now);
  const lit = l.status === "lit" && !spent;
  const text = spent ? "spent" : !lit ? "out" : l.shuttered ? "shut" : formatRemaining(remaining(l, now));
  const what = `${label}: ${spent ? "burned out" : !lit ? "out" : l.shuttered ? "shuttered" : `${text} left`}`;
  const look = `flex h-6 items-center gap-1 rounded-full px-2 font-mono text-xs tabular-nums ${
    lit && !l.shuttered ? (low(l, now) ? "bg-red-600/15 text-red-700 dark:text-red-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300") : "bg-obr-text/10 text-obr-text-secondary"
  }`;
  const icon = (
    <span className={lit && !l.shuttered ? "" : "grayscale"} aria-hidden>
      {ICONS[l.kind]}
    </span>
  );
  if (!change)
    return (
      <span role="img" aria-label={what} title={what} className={look}>
        {icon}
        {text}
      </span>
    );
  const action = lit ? "put out" : spent ? "relight" : "light";
  return (
    <button
      type="button"
      aria-label={`${what}. Click to ${action}`}
      title={`Click to ${action}`}
      className={`${look} hover:ring-1 hover:ring-current ${FOCUS}`}
      onClick={() =>
        lit
          ? change(`Put out ${label.toLowerCase()}`, (s, t) => putOut(s, t, l.id))
          : change(`${spent ? "Relight" : "Resume"} ${label.toLowerCase()}`, (s, t) => relight(s, t, l.id))
      }
    >
      {icon}
      {text}
    </button>
  );
};

export default LightBadges;
