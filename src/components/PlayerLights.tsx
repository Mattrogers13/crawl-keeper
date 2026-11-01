import type { Item } from "@owlbear-rodeo/sdk";

import { Banner, ICONS } from "./LightTracker";
import Loading from "./Loading";
import YourLight from "./YourLight";
import { SETTINGS_KEY } from "../constants";
import { useLights } from "../hooks/useLights";
import { useNow } from "../hooks/useNow";
import { useRoomValue } from "../hooks/useRoomValue";
import { LIGHT_KINDS, burnedOut, formatRemaining, lightStatus, low, remaining, shiningCount, type Light } from "../lights";
import { parseSettings } from "../settings";

// The players' Light Tracker (the flame in their header, like the GM's): the
// party's light, their own lights with their buttons (YourLight), and every
// light read-only, as the GM allows. Kept off the tracker so the list
// doesn't move down (Matt, 2026-11-01).
const PlayerLights = ({ items }: { items: Item[] }) => {
  const { loaded, lights: s } = useLights();
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  const now = useNow();
  if (!loaded || !settings.loaded) return <Loading />;
  const { showLights, playersLight, followLight } = settings.value;
  const names = new Map(items.map((i) => [i.id, i.name?.trim() || "Unnamed"]));

  return (
    <div className="flex flex-col gap-3 pb-3 text-sm">
      {showLights && <Banner status={lightStatus(s, now)} count={shiningCount(s, now)} paused={s.paused} followLight={followLight} player />}
      <YourLight items={items} lights={s} allowed={playersLight} />
      {playersLight && <p className="text-xs text-obr-text-secondary">To light a party token, right-click it → Crawl Keeper.</p>}
      {showLights && s.lights.length > 0 && (
        <section aria-label="The party's lights" className="flex flex-col gap-1">
          <h2 className="text-[11px] font-semibold tracking-wider text-obr-text-secondary">THE PARTY'S LIGHTS</h2>
          <ul className="flex flex-col">
            {s.lights.map((l) => (
              <LightLine key={l.id} light={l} name={names.get(l.tokenId) ?? l.carrier} now={now} />
            ))}
          </ul>
        </section>
      )}
      {!showLights && !playersLight && <p className="text-xs text-obr-text-secondary">The GM is tracking light at this table.</p>}
    </div>
  );
};

const LightLine = ({ light: l, name, now }: { light: Light; name: string; now: number }) => {
  const spent = burnedOut(l, now);
  const lit = l.status === "lit" && !spent;
  const state = lit ? formatRemaining(remaining(l, now)) : spent ? (l.kind === "lantern" ? "empty" : "spent") : `out · ${formatRemaining(l.remainingMs)}`;
  return (
    <li className="flex items-center gap-2 border-b border-obr-text/10 py-1.5 last:border-b-0">
      <span className={lit ? "" : "grayscale"} aria-hidden>
        {ICONS[l.kind]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">{name || "Unnamed"}</span>
        <span className="text-xs text-obr-text-secondary">{LIGHT_KINDS[l.kind].label}</span>
      </span>
      <span className={`font-mono tabular-nums ${!lit ? "text-obr-text-secondary" : low(l, now) ? "text-red-700 dark:text-red-300" : ""}`}>{state}</span>
    </li>
  );
};

export default PlayerLights;
