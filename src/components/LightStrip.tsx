import { TimePasses } from "./LightTracker";
import type { LightChange } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import { LIGHT_KINDS, burnedOut, type Lights } from "../lights";

// The GM's light strip under the title (mockups ck-01, ck-08): Time passes,
// total darkness, and lights that burned out.
const LightStrip = (props: { lights: Lights; dark: boolean; change: LightChange; names: Map<string, string> }) => {
  const now = useNow();
  const { dark } = props;
  const spent = props.lights.lights.filter((l) => burnedOut(l, now));
  const first = spent[0];
  return (
    <section
      aria-label="Lights"
      className={`flex flex-col gap-2 rounded-[14px] px-3 py-2 ring-1 ring-inset ${dark ? "bg-red-600/10 ring-red-600/30" : "bg-obr-bg ring-obr-text/10"}`}
    >
      <TimePasses change={props.change} compact />
      {(dark || first) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {dark && <span className="rounded-full bg-red-700 px-2.5 py-0.5 font-medium text-white">No light · total darkness</span>}
          {first && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-amber-800 dark:text-amber-300">
              {LIGHT_KINDS[first.kind].label} · {props.names.get(first.tokenId) ?? first.carrier} burned out
              {spent.length > 1 && ` (+${spent.length - 1})`}
            </span>
          )}
        </div>
      )}
    </section>
  );
};

export default LightStrip;
