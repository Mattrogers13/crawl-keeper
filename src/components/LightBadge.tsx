import { ICONS } from "./LightTracker";
import { FOCUS } from "./CrawlBar";
import { useNow } from "../hooks/useNow";
import { LIGHT_KINDS, burnedOut, formatRemaining, low, remaining, shownLight, type Light } from "../lights";

// A row's light (mockups ck-03 to ck-08): one badge per token, so rows don't
// fill up. It shows the lit light's time left, else the lantern that's out,
// else the last one spent; the Light Tracker lists them all. The GM clicks it
// to open the Light Tracker (Matt, 2026-11-07: a click used to put the light
// out); players see it only.
const LightBadge = ({ lights, open }: { lights: Light[]; open: (() => void) | null }) => {
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
  if (!open)
    return (
      <span role="img" aria-label={what} title={what} className={look}>
        {icon}
        {text}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={`${what}. Open the Light Tracker`}
      title="Open the Light Tracker"
      className={`${look} hover:ring-1 hover:ring-current ${FOCUS}`}
      onClick={open}
    >
      {icon}
      {text}
    </button>
  );
};

export default LightBadge;
