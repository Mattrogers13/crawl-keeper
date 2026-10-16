import { useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

import Loading from "./Loading";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { useRoomValue } from "../hooks/useRoomValue";
import { syncTurnFromScene } from "../marker";
import { errorMessage } from "../utils";
import { parseSettings, type Settings as SettingsDoc } from "../settings";

// The GM's settings (room metadata, so they follow the party across maps).
const Settings = () => {
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  if (!settings.loaded) return <Loading />;
  const set = (s: Partial<SettingsDoc>) => void settings.write({ ...settings.value, ...s });

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Check
        label="Hide rounds from players"
        hint="Players see Crawl or Combat, not the round count."
        checked={settings.value.hideRound}
        onChange={(hideRound) => set({ hideRound })}
      />
      <Check
        label="Clear initiative rolls on combat"
        hint="Everyone rolls fresh for combat (core p. 88). The combat order carries on when you switch back to Crawl."
        checked={settings.value.clearRollsOnCombat}
        onChange={(clearRollsOnCombat) => set({ clearRollsOnCombat })}
      />
      <Check
        label="Show the turn marker on the map"
        hint="A gold ring on the current token. Per token in its row menu: on for players and allies, off for monsters to start. Hidden tokens' rings stay hidden."
        checked={settings.value.showMarker}
        onChange={(showMarker) => {
          set({ showMarker });
          // Add or remove it now, not at the next turn.
          void syncTurnFromScene({ showMarker });
        }}
      />

      <Check
        label="Select the current token"
        hint="On your screen only, each turn."
        checked={settings.value.selectOnTurn}
        onChange={(selectOnTurn) => set({ selectOnTurn })}
      />
      <DataSize />
      <InstallLink />
    </div>
  );
};

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
    <div className="flex flex-col gap-0.5 border-t border-obr-text-disabled pt-3">
      <span>Saved data</span>
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
    <div className="flex flex-col gap-1 border-t border-obr-text-disabled pt-3">
      <label htmlFor="install-link">Install link</label>
      <div className="flex gap-1">
        <input
          id="install-link"
          ref={input}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-obr-text-disabled bg-obr-bg px-1 py-0.5 text-xs"
        />
        <button type="button" className="rounded border border-obr-text-disabled px-2 py-0.5 text-xs font-medium" onClick={copy}>
          Copy
        </button>
      </div>
      <span className="text-xs text-obr-text-secondary" role="status">
        {status || "In Owlbear: Extensions → Add Custom Extension, then paste."}
      </span>
    </div>
  );
};

const Check = (props: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start gap-2">
    <input type="checkbox" className="mt-0.5" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    <span className="flex flex-col">
      {props.label}
      <span className="text-xs text-obr-text-secondary">{props.hint}</span>
    </span>
  </label>
);

export default Settings;
