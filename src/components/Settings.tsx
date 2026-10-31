import { useEffect, useRef, useState, type ReactNode } from "react";
import OBR from "@owlbear-rodeo/sdk";

import ClockRules from "./ClockRules";
import Loading from "./Loading";
import Segmented from "./Segmented";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { useRoomValue } from "../hooks/useRoomValue";
import { syncTurnFromScene } from "../marker";
import { record } from "../undo";
import { errorMessage } from "../utils";
import { parseSettings, type Settings as SettingsDoc } from "../settings";

// The GM's settings (room metadata, so they follow the party across maps),
// grouped into cards like Owlbear's own settings: a segmented pill for the
// encounter method, switches for the rest.
// The undo step's name for each setting (short forms of the switches' labels).
const SETTING_LABELS: Partial<Record<keyof SettingsDoc, string>> = {
  encounterRolls: "encounter method",
  followLight: "Follow light",
  autoRoll: "roll automatically",
  showRolls: "show rolls",
  hideRound: "hide rounds",
  hideClock: "hide the clock",
  showDanger: "show danger",
  clearRollsOnCombat: "clear rolls on combat",
  showMarker: "turn marker",
  selectOnTurn: "select token",
};

// The four ways to run encounters, as the web toolkit shows them: one choice
// over the three stored fields (encounterRolls, encounterMode, clockDice).
// The clock size is kept when leaving the clock, as before.
type Method = "interval" | "clock1" | "clock2" | "manual";
const METHODS: Record<Method, Partial<SettingsDoc>> = {
  interval: { encounterRolls: true, encounterMode: "standard" },
  clock1: { encounterRolls: true, encounterMode: "clock", clockDice: 1 },
  clock2: { encounterRolls: true, encounterMode: "clock", clockDice: 2 },
  manual: { encounterRolls: false },
};
const METHOD_HINTS: Record<Method, string> = {
  interval: "Core rules: a d6 every few crawl rounds by danger level; an encounter on a 1 (p. 112).",
  clock1: "A d20 clock from 20 that the crawling die wears down each crawl round; an encounter at 0.",
  clock2: "The same clock from 40, worn down one d20 at a time; an encounter when both are empty.",
  manual:
    "No clock and no auto roll. The card shows the danger level and lights up on your turn when a check is due; roll its d6 or one at the table. A due check counts as made when you move on.",
};

const Settings = () => {
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  if (!settings.loaded) return <Loading />;
  // Each change is an undo step named for the setting.
  const set = (s: Partial<SettingsDoc>) => {
    const before = settings.value;
    const after = { ...before, ...s };
    void settings.write(after).then((saved) => {
      if (saved) void record(`Setting: ${SETTING_LABELS[Object.keys(s)[0] as keyof SettingsDoc] ?? "settings"}`, [{ store: "room", key: SETTINGS_KEY, before, after }]);
    });
  };
  const rolls = settings.value.encounterRolls;
  const clock = rolls && settings.value.encounterMode === "clock";
  const method: Method = !rolls ? "manual" : !clock ? "interval" : settings.value.clockDice === 2 ? "clock2" : "clock1";

  return (
    <div className="flex flex-col gap-4 pb-3 text-sm">
      {/* The extension's homepage (outside Owlbear it's the how-to guide); a new tab. */}
      <a
        href={`${window.location.origin}/`}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-xl bg-obr-bg px-4 py-3 ring-1 ring-obr-text/10 ring-inset hover:bg-obr-text/10 focus-visible:ring-2 focus-visible:ring-obr-primary focus-visible:outline-none"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-obr-primary/15 font-bold text-obr-primary" aria-hidden>
          ?
        </span>
        <span className="flex flex-1 flex-col">
          <span className="font-medium">How to use Crawl Keeper</span>
          <span className="text-xs text-obr-text-secondary">Setup, turns, hotkeys, crawling and combat</span>
        </span>
        <OpenIcon />
      </a>

      <Group title="Encounters">
        <div className="flex flex-col gap-2 px-4 py-3">
          <Segmented
            label="Encounter checks"
            name="encounter-method"
            value={method}
            options={[
              ["interval", "Interval"],
              ["clock1", "Clock 1d20"],
              ["clock2", "Clock 2d20"],
              ["manual", "Manual"],
            ]}
            onChange={(m) => set(METHODS[m])}
          />
          <p className="text-xs text-obr-text-secondary">{METHOD_HINTS[method]}</p>
          {clock && (
            <details className="rounded-lg bg-obr-paper px-3 py-2">
              <summary className="cursor-pointer font-medium">Crawling Clock rules</summary>
              <div className="pt-2">
                <ClockRules />
              </div>
            </details>
          )}
        </div>
        {rolls && (
          <Toggle
            label="Roll automatically on the GM turn"
            hint="When ▶ reaches GM / Monsters in a crawl round and a roll is due, Crawl Keeper rolls it for you. Undo still works."
            checked={settings.value.autoRoll}
            onChange={(autoRoll) => set({ autoRoll })}
          />
        )}
      </Group>

      <Group title="Darkness (p. 84)">
        <Toggle
          label="Follow light"
          hint="When the Light Tracker has no light lit, it's total darkness: a check every crawl round in Interval mode, a d8 crawling die in clock modes, DIS on the party's rows, and a 3 ft light on their tokens so players still see themselves. The danger level stays. With no lights tracked, or off: set darkness yourself."
          checked={settings.value.followLight}
          onChange={(followLight) => set({ followLight })}
        />
        {/* The switch itself is on the crawl card: darkness is per map, in
            the map's tracker doc, which only the tracker writes. */}
        <p className="text-xs text-obr-text-secondary">
          <span className="font-medium text-obr-text">Darkness by hand:</span> the Torchlit / Darkness switch on the crawl card, for each map.
          {settings.value.followLight && " Locked while there are lights to follow."}
        </p>
      </Group>

      <Group title="What players see">
        {/* Manual: the rolls are the GM's own, never shown. */}
        {rolls && (
          <Toggle
            label="Show the rolls to players"
            hint={
              clock
                ? "Players see the crawling die's last roll and what it did to the clock."
                : "Players see the last encounter check and whether it was an encounter."
            }
            checked={settings.value.showRolls}
            onChange={(showRolls) => set({ showRolls })}
          />
        )}
        <Toggle
          label="Hide rounds from players"
          hint="Players see Crawl or Combat but not the round number."
          checked={settings.value.hideRound}
          onChange={(hideRound) => set({ hideRound })}
        />
        {clock ? (
          <Toggle
            label="Hide the clock from players"
            hint="Players don't see the Crawling Clock, so they can't play around it."
            checked={settings.value.hideClock}
            onChange={(hideClock) => set({ hideClock })}
          />
        ) : (
          <Toggle
            label="Show the danger level to players"
            hint="Players see Unsafe, Risky or Deadly while crawling. The book leaves it to the GM."
            checked={settings.value.showDanger}
            onChange={(showDanger) => set({ showDanger })}
          />
        )}
      </Group>

      <Group title="Turns and combat">
        <Toggle
          label="Clear initiative rolls on combat"
          hint="Switching to Combat empties every roll so everyone rolls fresh (core p. 88)."
          checked={settings.value.clearRollsOnCombat}
          onChange={(clearRollsOnCombat) => set({ clearRollsOnCombat })}
        />
        <Toggle
          label="Show the turn marker on the map"
          hint="A gold ring around whoever's turn it is. Turn it on or off per token from the row menu (a gold dot shows which have it)."
          checked={settings.value.showMarker}
          onChange={(showMarker) => {
            set({ showMarker });
            // Add or remove it now, not at the next turn.
            void syncTurnFromScene({ showMarker });
          }}
        />
        <Toggle
          label="Select the current token"
          hint="Each turn, Owlbear selects that token on your screen so you can move it right away. Players' screens don't change."
          checked={settings.value.selectOnTurn}
          onChange={(selectOnTurn) => set({ selectOnTurn })}
        />
      </Group>

      <Group title="About">
        <DataSize />
        <InstallLink />
      </Group>
    </div>
  );
};

// A titled card of rows, divided by hairlines.
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-1.5">
    <h3 className="px-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">{title}</h3>
    <div className="flex flex-col divide-y divide-obr-text/10 rounded-xl bg-obr-bg ring-1 ring-obr-text/10 ring-inset">{children}</div>
  </section>
);

const kB = (value: unknown) => `${(new Blob([JSON.stringify(value) ?? ""]).size / 1000).toFixed(1)} kB`;

// How much Owlbear is storing, read when Settings opens. The room limit is
// documented (16 kB, all extensions together); the scene limit isn't.
const DataSize = () => {
  const [sizes, setSizes] = useState<{ tracker: string; scene: string; room: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([OBR.scene.isReady(), OBR.room.getMetadata()])
      .then(async ([ready, room]) => {
        const scene = ready ? await OBR.scene.getMetadata() : null;
        if (alive) setSizes({ tracker: scene ? kB(scene[TRACKER_KEY]) : "–", scene: scene ? kB(scene) : "–", room: kB(room) });
      })
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="font-medium">Saved data</span>
      <span className="text-xs text-obr-text-secondary" role="status">
        {error
          ? `Couldn't read: ${error}`
          : sizes
            ? `This map: ${sizes.tracker} tracker, ${sizes.scene} all extensions (limit not documented). Room: ${sizes.room} of 16 kB, all extensions.`
            : "Reading…"}
      </span>
    </div>
  );
};

// This build's manifest: live on the live install, Dev on the Dev one.
const InstallLink = () => {
  const url = `${window.location.origin}/manifest.json`;
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  // The clipboard may be missing or blocked inside Owlbear's iframe: fall
  // back to selecting the text for Cmd+C.
  const copy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(() => setStatus("Copied"))
      .catch(() => {
        input.current?.select();
        setStatus("Press Cmd+C (Ctrl+C) to copy");
      });

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <label htmlFor="install-link" className="font-medium">
        Install link
      </label>
      <div className="flex gap-1">
        <input
          id="install-link"
          ref={input}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 min-w-0 flex-1 rounded-full bg-obr-paper px-3 text-xs focus:ring-2 focus:ring-obr-primary focus:outline-none"
        />
        <button type="button" className="h-8 rounded-full bg-obr-paper px-4 text-xs font-medium hover:bg-obr-text/10" onClick={copy}>
          Copy
        </button>
      </div>
      <span className="text-xs text-obr-text-secondary" role="status">
        {status || "In Owlbear: Extensions → Add Custom Extension, then paste."}
      </span>
    </div>
  );
};

// One setting: label and hint on the left, a switch on the right (a real
// checkbox underneath, so the label, keyboard and screen readers work).
const Toggle = (props: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
    <span className="flex flex-1 flex-col gap-0.5">
      {props.label}
      <span className="text-xs text-obr-text-secondary">{props.hint}</span>
    </span>
    <input
      type="checkbox"
      role="switch"
      className="peer sr-only"
      checked={props.checked}
      onChange={(e) => props.onChange(e.target.checked)}
    />
    <span
      aria-hidden
      className="relative h-6 w-10 shrink-0 rounded-full bg-obr-text/25 transition-colors peer-checked:bg-obr-primary peer-focus-visible:ring-2 peer-focus-visible:ring-obr-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-obr-bg after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
    />
  </label>
);

// An arrow out of a box: opens in a new tab.
const OpenIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-obr-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export default Settings;
