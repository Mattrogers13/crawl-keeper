import { useEffect, useState, type ReactNode } from "react";
import OBR, { type Item, type Player } from "@owlbear-rodeo/sdk";

import { ICONS } from "./LightTracker";
import { FOCUS } from "./CrawlBar";
import { readAndFollow } from "../hooks/readAndFollow";
import { useNow } from "../hooks/useNow";
import { LIGHT_KINDS, MINUTE, burnedOut, formatRemaining, low, remaining, shownLight, type LightKind, type Lights } from "../lights";
import { PLAYER_KINDS, ownsToken, requestLight, verbFor } from "../playerLights";
import { notify } from "../utils";

// Whether a GM is in the room (OBR.party lists everyone but this client);
// null until known.
const useGmPresent = () => {
  const [present, setPresent] = useState<boolean | null>(null);
  useEffect(
    () =>
      readAndFollow({
        read: () => OBR.party.getPlayers(),
        follow: (take) => OBR.party.onChange(take),
        take: (players: Player[]) => setPresent(players.some((p) => p.role === "GM")),
        what: "who's in the room",
      }),
    [],
  );
  return present;
};

const lower = (kind: LightKind) => (kind === "lightSpell" ? "Light spell" : LIGHT_KINDS[kind].label.toLowerCase());

// A player's own lights (mockup player-lights.html, "Your light"): the light
// on each token they placed, and, when the GM allows, light one or put it
// out. Each click asks the GM's client (playerLights.ts), which saves it.
const YourLight = ({ items, lights, allowed }: { items: Item[]; lights: Lights; allowed: boolean }) => {
  const now = useNow();
  const gmPresent = useGmPresent();
  const [busy, setBusy] = useState(false);
  // "token:kind" while asking "Put out the torch, light the lantern?".
  const [asking, setAsking] = useState<string | null>(null);
  const mine = items.filter((i) => ownsToken(i, OBR.player.id));
  const withLight = mine.map((token) => ({ token, light: shownLight(lights.lights.filter((l) => l.tokenId === token.id)) }));
  const can = allowed && gmPresent === true;
  // Nothing to show: no token of theirs, or nothing lit and nothing to do.
  if (mine.length === 0 || (!allowed && withLight.every((w) => !w.light))) return null;

  const ask = async (req: Parameters<typeof requestLight>[0]) => {
    setBusy(true);
    setAsking(null);
    const error = await requestLight(req);
    setBusy(false);
    if (error) notify(error, "WARNING");
  };

  return (
    <section aria-label="Your light" className="flex flex-col gap-2 rounded-[14px] bg-obr-bg px-3 py-2.5 ring-1 ring-obr-text/10 ring-inset">
      <h2 className="text-[11px] font-semibold tracking-wider text-obr-text-secondary">YOUR LIGHT</h2>
      {withLight.map(({ token, light: l }) => {
        const spent = l ? burnedOut(l, now) : false;
        const lit = !!l && l.status === "lit" && !spent;
        const waiting = !!l && l.status === "out";
        const left = l ? (lit ? remaining(l, now) : l.remainingMs) : 0;
        const full = l ? LIGHT_KINDS[l.kind].minutes * MINUTE : 1;
        const name = token.name?.trim() || "Unnamed";
        return (
          <div key={token.id} className="flex flex-col gap-1.5">
            {mine.length > 1 && <span className="text-xs font-medium">{name}</span>}
            {l && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={lit ? "" : "grayscale"} aria-hidden>
                    {ICONS[l.kind]}
                  </span>
                  <span className="flex flex-1 flex-col leading-tight">
                    <span className="text-sm font-medium">{LIGHT_KINDS[l.kind].label}</span>
                    <span className="text-xs text-obr-text-secondary">
                      {lit ? LIGHT_KINDS[l.kind].range : waiting ? "out" : l.kind === "lantern" ? "out of oil" : "spent"}
                    </span>
                  </span>
                  <span className={`font-mono text-sm tabular-nums ${lit && low(l, now) ? "text-red-700 dark:text-red-300" : ""}`}>
                    {formatRemaining(left)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-obr-text/10" aria-hidden>
                  <div className={`h-full rounded-full ${lit ? "bg-amber-500" : "bg-obr-text/30"}`} style={{ width: `${Math.round((left / full) * 100)}%` }} />
                </div>
                {can && (lit || waiting) && (
                  <div className="flex gap-1.5">
                    <Button
                      disabled={busy}
                      primary={waiting}
                      onClick={() => void ask(lit ? { tokenId: token.id, action: "putOut" } : { tokenId: token.id, action: "light", kind: l.kind })}
                    >
                      {lit ? "Put out" : `Light lantern (${formatRemaining(l.remainingMs)})`}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {can && (
              <div className="flex flex-wrap gap-1.5">
                {PLAYER_KINDS.filter((k) => !(lit && l.kind === k) && !(waiting && l.kind === k)).map((kind) => {
                  const key = `${token.id}:${kind}`;
                  const light = () => void ask({ tokenId: token.id, action: "light", kind });
                  if (asking === key && lit)
                    return (
                      <span key={kind} role="alertdialog" aria-label={`Put out the ${lower(l.kind)}, ${verbFor(kind).toLowerCase()}?`} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span>
                          Put out the {lower(l.kind)}, {verbFor(kind).toLowerCase()}?
                        </span>
                        <Button disabled={busy} primary onClick={light}>
                          {verbFor(kind)}
                        </Button>
                        <Button onClick={() => setAsking(null)}>Cancel</Button>
                      </span>
                    );
                  if (asking?.startsWith(`${token.id}:`)) return null;
                  return (
                    <Button key={kind} disabled={busy} onClick={() => (lit ? setAsking(key) : light())}>
                      + {LIGHT_KINDS[kind].label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!allowed && <p className="text-xs text-obr-text-secondary">The GM lights and puts out lights at this table.</p>}
      {allowed && gmPresent === false && <p className="text-xs text-obr-text-secondary">The GM isn't in the room. You can light once they're back.</p>}
      {can && withLight.some((w) => w.light?.status === "lit") && (
        <p className="text-xs text-obr-text-secondary">One lit light per token: lighting another puts this one out first.</p>
      )}
    </section>
  );
};

const Button = (props: { onClick: () => void; disabled?: boolean; primary?: boolean; children: ReactNode }) => (
  <button
    type="button"
    disabled={props.disabled}
    onClick={props.onClick}
    className={`h-7 rounded-full px-3 text-xs font-medium disabled:opacity-50 ${FOCUS} ${
      props.primary ? "bg-obr-primary text-obr-primary-contrast" : "bg-obr-text/10 hover:bg-obr-text/15"
    }`}
  >
    {props.children}
  </button>
);

export default YourLight;
