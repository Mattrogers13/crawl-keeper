import Loading from "./Loading";
import { SETTINGS_KEY } from "../constants";
import { useRoomValue } from "../hooks/useRoomValue";
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
        hint="Everyone rolls fresh for combat (core p. 88). The crawl order comes back when you switch to Crawl."
        checked={settings.value.clearRollsOnCombat}
        onChange={(clearRollsOnCombat) => set({ clearRollsOnCombat })}
      />
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
