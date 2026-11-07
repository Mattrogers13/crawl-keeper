import { useEffect, useState, type ReactNode } from "react";
import OBR from "@owlbear-rodeo/sdk";

import ClockRules from "./ClockRules";
import { downloadLog } from "./SessionLog";
import { ScrollIcon } from "./icons";
import Loading from "./Loading";
import Segmented from "./Segmented";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { useRoomValue } from "../hooks/useRoomValue";
import { syncTurnFromScene } from "../marker";
import { checkDicePlus, setDicePlusEnabled } from "../diceRoller";
import { resetAll } from "../resetAll";
import { readLog } from "../sessionLog";
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
  showRound: "show rounds",
  showClock: "show the clock",
  showDanger: "show the danger level",
  clearRollsOnCombat: "clear rolls on combat",
  showMarker: "turn marker",
  selectOnTurn: "select token",
  showLights: "show lights",
  playersLight: "players light their own",
  effectIcons: "effect icons",
  dicePlus: "roll with Dice+",
  showDeath: "show the death timer",
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

// openLog: the Session log view (Panel's).
const Settings = (props: { openLog?: () => void }) => {
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
      {/* The session log: every notice, kept so the tracker can let them go. */}
      {props.openLog && (
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl bg-obr-bg px-4 py-3 text-left ring-1 ring-obr-text/10 ring-inset hover:bg-obr-text/10 focus-visible:ring-2 focus-visible:ring-obr-primary focus-visible:outline-none"
          onClick={props.openLog}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-obr-primary/15 text-obr-primary" aria-hidden>
            <ScrollIcon />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-medium">Session log</span>
            <span className="text-xs text-obr-text-secondary">Lights out, Time passes, effects ending, combat, focus lost</span>
          </span>
          <span className="text-obr-text-secondary" aria-hidden>
            ›
          </span>
        </button>
      )}

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
          hint="No light shining means darkness: DIS on the party's rows, a check every crawl round, a d8 crawling die. With no lights tracked, or off, set it yourself."
          checked={settings.value.followLight}
          onChange={(followLight) => set({ followLight })}
        />
        {/* The switch itself is on the crawl card: darkness is per map, in
            the map's tracker doc, which only the tracker writes. */}
        <p className="px-4 py-3 text-xs text-obr-text-secondary">
          <span className="font-medium text-obr-text">Darkness by hand:</span> the Torchlit / Darkness switch on the crawl card, for each map.
          {settings.value.followLight && " Locked while there are lights to follow."}
        </p>
      </Group>

      <Group title="Players' lights">
        <Toggle
          label="Players light their own"
          hint="Players right-click a party token (a player on the list, or one they placed) → Crawl Keeper: a torch, lantern or Light spell, one lit at a time, or put it out; their panel shows their lights. Only while you're in the room: your Crawl Keeper checks and makes the change."
          checked={settings.value.playersLight}
          onChange={(playersLight) => set({ playersLight })}
        />
      </Group>

      <Group title="What players see">
        <Toggle
          label="Show lights to players"
          hint="Whether the party has light, the badges on the rows and DIS in darkness. Off: only their own lights."
          checked={settings.value.showLights}
          onChange={(showLights) => set({ showLights })}
        />
        <Toggle
          label="Show the death timer to players"
          hint="The Dying line and icon, its notices and the death rolls (the book has them in the open, p. 89). Off: only you see them."
          checked={settings.value.showDeath}
          onChange={(showDeath) => set({ showDeath })}
        />
        <Toggle
          label="Show rolls to players"
          hint={
            clock
              ? "The crawling die's last roll and what it did to the clock. Off: only you see your rolls."
              : "The last encounter check and whether it was an encounter, including the manual die. Off: only you see your rolls."
          }
          checked={settings.value.showRolls}
          onChange={(showRolls) => set({ showRolls })}
        />
        <Toggle
          label="Show rounds to players"
          hint="The round number. Off: players see Crawl or Combat only."
          checked={settings.value.showRound}
          onChange={(showRound) => set({ showRound })}
        />
        {clock ? (
          <Toggle
            label="Show the clock to players"
            hint="The Crawling Clock. Off: players can't play around it."
            checked={settings.value.showClock}
            onChange={(showClock) => set({ showClock })}
          />
        ) : (
          <Toggle
            label="Show the danger level to players"
            hint="Unsafe, Risky or Deadly while crawling. The book leaves it to the GM."
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
          label="Show effect icons on the map"
          hint="Focus, ADV, DIS, conditions and other effects as small icons along the token's bottom edge (three, then +). Hidden effects show only to you. Turn it off if you use a condition marker extension."
          checked={settings.value.effectIcons}
          onChange={(effectIcons) => set({ effectIcons })}
        />
        <Toggle
          label="Select the current token"
          hint="Each turn, Owlbear selects that token on your screen so you can move it right away. Players' screens don't change."
          checked={settings.value.selectOnTurn}
          onChange={(selectOnTurn) => set({ selectOnTurn })}
        />
      </Group>

      <Group title="Dice">
        <Toggle
          label="Roll with Dice+ when it's installed"
          hint="Encounter checks, the clock, the monsters' initiative and the death timer roll as 3D dice everyone sees (encounter rolls only to you, unless players are set to see the rolls). Without Dice+, they roll here."
          checked={settings.value.dicePlus}
          onChange={(dicePlus) => set({ dicePlus })}
        />
        <DicePlusStatus on={settings.value.dicePlus} />
      </Group>

      <Group title="About">
        <DataSize />
      </Group>

      {/* A fresh session, last on the page (Matt): one big warning first. */}
      <Group title="Session">
        <div className="flex flex-col gap-1 px-4 py-3">
          <ResetAll />
          <span className="text-xs text-obr-text-secondary">
            A new session: clears this map's tracker (the GM row stays), its effects, the lights on its tokens and the session log, and sets the danger
            level back to Unsafe.
          </span>
        </div>
      </Group>
    </div>
  );
};

// One big warning before a reset: what goes, that the log can't come back
// (download it first), and that Undo brings back the rest.
const ResetAll = () => {
  const [asking, setAsking] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const log = asking ? readLog() : [];
  const close = () => {
    setAsking(false);
    setDownloaded(false);
  };
  if (!asking)
    return (
      <span className="flex flex-col gap-1">
        <button type="button" className="self-start py-1 text-red-700 underline hover:text-red-600 dark:text-red-300" onClick={() => setAsking(true)}>
          Reset all…
        </button>
        {error && (
          <span role="alert" className="text-xs text-red-700 dark:text-red-300">
            {error}
          </span>
        )}
      </span>
    );
  return (
    <div
      role="alertdialog"
      aria-label="Reset all"
      className="flex flex-col gap-2 rounded-xl bg-red-600/15 p-3 text-xs ring-2 ring-red-600/60 ring-inset"
      onKeyDown={(ev) => ev.key === "Escape" && close()}
    >
      <span className="text-sm font-semibold text-red-800 dark:text-red-200">⚠ Reset everything for a new session?</span>
      <ul className="flex list-disc flex-col gap-1 pl-4">
        <li>Every token leaves this map's tracker (the GM row stays). Rounds, Crawl / Combat and the clock start over.</li>
        <li>Every effect on this map is removed, with its icons on the map.</li>
        <li>The lights on those tokens are removed.</li>
        <li>
          <span className="font-semibold">The session log is cleared. That can't be undone.</span>{" "}
          {log.length > 0 ? "Download it first?" : "It's empty."}
        </li>
      </ul>
      {log.length > 0 && (
        <button
          type="button"
          className="self-start rounded-full bg-obr-paper px-3 py-1 font-medium hover:bg-obr-text/10"
          onClick={() => {
            downloadLog(log);
            setDownloaded(true);
          }}
        >
          {downloaded ? "Downloaded ✓ (again?)" : `Download the log (${log.length})`}
        </button>
      )}
      <span className="text-obr-text-secondary">Undo can bring back the tracker, effects and lights, not the log.</span>
      <span className="flex justify-end gap-1.5">
        <button type="button" className="h-8 rounded-full bg-obr-paper px-4 font-medium hover:bg-obr-text/10" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className="h-8 rounded-full bg-red-700 px-4 font-medium text-white hover:bg-red-600 disabled:opacity-60"
          onClick={() => {
            setError("");
            setBusy(true);
            resetAll()
              .catch((err) => setError(`Couldn't reset, so nothing changed: ${errorMessage(err)}`))
              .finally(() => {
                setBusy(false);
                close();
              });
          }}
        >
          Reset all
        </button>
      </span>
    </div>
  );
};

// Whether Dice+ answered (checked when Settings opens and on the switch).
const DicePlusStatus = ({ on }: { on: boolean }) => {
  const [found, setFound] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    setDicePlusEnabled(on);
    if (!on) return;
    setFound(null);
    void checkDicePlus().then((ok) => alive && setFound(ok));
    return () => {
      alive = false;
    };
  }, [on]);
  if (!on) return null;
  return (
    <span role="status" className="px-4 pb-3 text-xs text-obr-text-secondary">
      {found === null ? "Looking for Dice+…" : found ? "Dice+ found: rolls go to Dice+." : "Dice+ not found: rolling here. Install Dice+ and reopen Settings."}
    </span>
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
