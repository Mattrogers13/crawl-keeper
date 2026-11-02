import { ICONS } from "./LightTracker";
import { FOCUS } from "./CrawlBar";
import type { LightChange } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import { LIGHT_KINDS, burnedOut, formatRemaining, low, newLightId, putOut, relight, remaining, renew, shownLight, type Light } from "../lights";

// A row's light (mockups ck-03 to ck-08): one badge per token, so rows don't
// fill up. It shows the lit light's time left, else the lantern that's out,
// else the last one spent; the Light Tracker lists them all. The GM clicks it
// to put the light out, light the lantern again, or light a new one; players
// see it only.
const LightBadge = ({ lights, change }: { lights: Light[]; change: LightChange | null }) => {
  const now = useNow();
  const l = shownLight(lights);
  if (!l) return null;
  const label = LIGHT_KINDS[l.kind].label;
  const lantern = l.kind === "lantern";
  const spent = burnedOut(l, now);
  const lit = l.status === "lit" && !spent;
  const text = spent ? (lantern ? "empty" : "spent") : !lit ? formatRemaining(l.remainingMs) : formatRemaining(remaining(l, now));
  const what = `${label}: ${spent ? (lantern ? "out of oil" : "spent") : !lit ? `out, ${text} of oil` : `${text} left`}`;
  const look = `flex h-6 shrink-0 items-center gap-1 rounded-full px-2 font-mono text-xs tabular-nums ${
    lit ? (low(l, now) ? "bg-red-600/15 text-red-700 dark:text-red-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300") : "bg-obr-text/10 text-obr-text-secondary"
  }`;
  const icon = (
    <span className={lit ? "" : "grayscale"} aria-hidden>
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
  const lower = label.toLowerCase();
  const [action, run]: [string, Parameters<LightChange>[1]] = lit
    ? [`Put out ${lower}`, (s, t) => putOut(s, t, l.id)]
    : !spent
      ? [`Light ${lower}`, (s, t) => relight(s, t, l.id)]
      : [lantern ? "Refill and light lantern" : `New ${lower}`, (s, t) => renew(s, t, newLightId, l.id)];
  return (
    <button
      type="button"
      aria-label={`${what}. Click: ${action.toLowerCase()}`}
      title={action}
      className={`${look} hover:ring-1 hover:ring-current ${FOCUS}`}
      onClick={() => change(action, run)}
    >
      {icon}
      {text}
    </button>
  );
};

export default LightBadge;
