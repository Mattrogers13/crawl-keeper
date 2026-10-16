import { useState, type ReactNode } from "react";
import type { Item } from "@owlbear-rodeo/sdk";

import Loading from "./Loading";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import type { Role } from "../hooks/useRole";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { parseSettings, type Settings } from "../settings";
import {
  GM_ENTRY,
  NOTE_MAX,
  ROLL_MAX,
  ROLL_MIN,
  move,
  next,
  parseTracker,
  previous,
  prune,
  remove,
  setDead,
  setNote,
  setRoll,
  sortByRoll,
  stop,
  type Entry,
  type Tracker as TrackerDoc,
} from "../tracker";

type Token = { name: string; image: string | null; visible: boolean };

// What the tracker shows for a token. Items are Owlbear data: don't trust
// their shape beyond what's checked here.
const tokenInfo = (item: Item | undefined): Token => {
  const image = (item as { image?: { url?: unknown } } | undefined)?.image?.url;
  return {
    name: item?.name?.trim() || "Unnamed",
    image: typeof image === "string" ? image : null,
    visible: item?.visible !== false,
  };
};

const Tracker = ({ role }: { role: Role }) => {
  const settings = useRoomValue(SETTINGS_KEY, parseSettings);
  const doc = useSceneValue(TRACKER_KEY, parseTracker);
  const items = useSceneItems();
  // The ▲▼ move buttons, off by default to keep rows quiet. Per GM, not saved.
  const [reorder, setReorder] = useState(false);

  if (!settings.loaded || !doc.loaded || items === null) return <Loading />;

  const byId = new Map(items.map((i) => [i.id, i]));
  // Tokens deleted from the map drop out. Writes save this pruned version.
  const tracker = prune(doc.value, (id) => byId.has(id));
  const gm = role === "GM";

  // Every GM edit: apply a pure change and save it if anything changed.
  const change = (fn: (t: TrackerDoc) => TrackerDoc) => {
    const updated = fn(tracker);
    if (updated !== doc.value) void doc.write(updated);
  };
  const changeSettings = (s: Partial<Settings>) => void settings.write({ ...settings.value, ...s });

  // Players never see hidden tokens. If it's a hidden token's turn, players
  // see the GM row as current instead.
  const shown = gm
    ? tracker.entries
    : tracker.entries.filter((e) => e.id === GM_ENTRY || tokenInfo(byId.get(e.id)).visible);
  const current = gm || shown.some((e) => e.id === tracker.current) ? tracker.current : tracker.current && GM_ENTRY;
  const roundShown = gm || !settings.value.hideRound;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">
          {tracker.round === 0 ? "Not started" : roundShown ? `Round ${tracker.round}` : "In progress"}
        </h2>
        {gm && settings.value.hideRound && <span className="text-xs text-obr-text-secondary">(hidden from players)</span>}
        {gm && (
          <div className="ml-auto flex gap-1">
            {tracker.round > 0 && (
              <>
                <Button label="Previous turn" onClick={() => change((t) => previous(t))}>
                  ◀
                </Button>
                <Button label="End" onClick={() => change(stop)}>
                  End
                </Button>
              </>
            )}
            <Button label={tracker.round === 0 ? "Start" : "Next turn"} primary onClick={() => change((t) => next(t))}>
              {tracker.round === 0 ? "Start" : "▶"}
            </Button>
          </div>
        )}
      </div>

      {gm && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button label="Sort by roll" onClick={() => change(sortByRoll)}>
            <SortIcon />
          </Button>
          <Button label="Reorder" pressed={reorder} onClick={() => setReorder(!reorder)}>
            ↕
          </Button>
          <label className="ml-auto flex items-center gap-1">
            <input
              type="checkbox"
              checked={settings.value.hideRound}
              onChange={(e) => changeSettings({ hideRound: e.target.checked })}
            />
            Hide round
          </label>
        </div>
      )}

      <ol className="flex flex-col gap-1">
        {shown.map((entry, i) => (
          <Row
            key={entry.id}
            entry={entry}
            token={entry.id === GM_ENTRY ? null : tokenInfo(byId.get(entry.id))}
            current={entry.id === current}
            gm={gm}
            isFirst={i === 0}
            isLast={i === shown.length - 1}
            change={change}
            reorder={reorder}
          />
        ))}
      </ol>
      {gm && tracker.entries.length === 1 && (
        <p className="text-sm text-obr-text-secondary">Right-click a token and choose “Add / Remove Initiative”.</p>
      )}
    </div>
  );
};

const Row = (props: {
  entry: Entry;
  token: Token | null;
  current: boolean;
  gm: boolean;
  isFirst: boolean;
  isLast: boolean;
  reorder: boolean;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
}) => {
  const { entry, token, gm, change } = props;
  const name = token ? token.name : "GM / Monsters";
  return (
    <li
      aria-current={props.current ? "step" : undefined}
      className={`flex items-start gap-2 rounded p-1.5 ${props.current ? "bg-obr-primary/20 ring-1 ring-obr-primary" : "bg-obr-bg"} ${
        token && !token.visible ? "opacity-60" : ""
      }`}
    >
      <Portrait token={token} dead={entry.dead} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-medium ${entry.dead ? "text-obr-text-secondary line-through" : ""}`}>
          {name}
          {entry.dead && <span className="sr-only"> (dead)</span>}
        </span>
        {gm ? (
          <NoteInput key={entry.note} name={name} value={entry.note} save={(n) => change((t) => setNote(t, entry.id, n))} />
        ) : (
          entry.note && <span className="text-sm whitespace-pre-wrap text-obr-text-secondary">{entry.note}</span>
        )}
      </div>
      {gm ? (
        <>
          <RollInput key={entry.roll ?? ""} name={name} value={entry.roll} save={(r) => change((t) => setRoll(t, entry.id, r))} />
          {props.reorder && (
            <div className="flex flex-col">
              <IconButton label={`Move ${name} up`} disabled={props.isFirst} onClick={() => change((t) => move(t, entry.id, -1))}>
                ▲
              </IconButton>
              <IconButton label={`Move ${name} down`} disabled={props.isLast} onClick={() => change((t) => move(t, entry.id, 1))}>
                ▼
              </IconButton>
            </div>
          )}
          {/* The GM row has no dead or remove button: same-width gaps keep the roll boxes lined up. */}
          {token ? (
            <>
              <RowAction
                label={`Dead: ${name}`}
                pressed={entry.dead}
                onClick={() => change((t) => setDead(t, entry.id, !entry.dead))}
              >
                <SkullIcon className="h-5 w-5" />
              </RowAction>
              <RowAction label={`Remove ${name}`} onClick={() => change((t) => remove(t, [entry.id]))}>
                <CloseIcon />
              </RowAction>
            </>
          ) : (
            <>
              <span className={ROW_ACTION} aria-hidden />
              <span className={ROW_ACTION} aria-hidden />
            </>
          )}
        </>
      ) : (
        <span className="w-10 text-right tabular-nums">{entry.roll ?? "–"}</span>
      )}
    </li>
  );
};

const Portrait = ({ token, dead }: { token: Token | null; dead: boolean }) => (
  <div className="relative h-9 w-9 shrink-0">
    {token?.image ? (
      <img src={token.image} alt="" className={`h-9 w-9 rounded-full object-cover ${dead ? "grayscale" : ""}`} />
    ) : (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-obr-paper text-xs font-semibold" aria-hidden>
        {token ? "?" : "GM"}
      </div>
    )}
    {dead && (
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white" aria-hidden>
        <SkullIcon className="h-6 w-6" />
      </span>
    )}
  </div>
);

// Saves on Enter or when focus leaves. Empty = no roll.
const RollInput = ({ name, value, save }: { name: string; value: number | null; save: (r: number | null) => void }) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const commit = () => {
    const n = draft.trim() === "" ? null : Number(draft);
    if (n === null || (Number.isInteger(n) && n >= ROLL_MIN && n <= ROLL_MAX)) save(n);
    else setDraft(value === null ? "" : String(value));
  };
  return (
    <input
      aria-label={`Initiative for ${name}`}
      inputMode="numeric"
      className="w-12 rounded border border-obr-text-disabled bg-obr-paper px-1 py-0.5 text-right tabular-nums focus:border-obr-primary focus:outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
};

const NoteInput = ({ name, value, save }: { name: string; value: string; save: (n: string) => void }) => {
  const [draft, setDraft] = useState(value);
  return (
    <input
      aria-label={`Note for ${name}`}
      placeholder="Add a note"
      maxLength={NOTE_MAX}
      className="w-full rounded border border-transparent bg-transparent px-1 text-sm text-obr-text-secondary hover:border-obr-text-disabled focus:border-obr-primary focus:outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && save(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
};

type ButtonProps = { label: string; pressed?: boolean; onClick: () => void; children: ReactNode };

const Button = ({ label, primary, pressed, onClick, children }: ButtonProps & { primary?: boolean }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={pressed}
    title={label}
    className={`flex min-h-6 items-center rounded px-2 py-0.5 text-sm font-medium ${
      primary || pressed ? "bg-obr-primary text-obr-primary-contrast" : "border border-obr-text-disabled"
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

const ICON_SLOT = "w-5 shrink-0";

// Dead and remove: full-size touch targets, the same width on every row (see Row).
const ROW_ACTION = "h-7 w-7 shrink-0";

const RowAction = (props: ButtonProps) => (
  <button
    type="button"
    aria-label={props.label}
    aria-pressed={props.pressed}
    title={props.label}
    className={`${ROW_ACTION} flex items-center justify-center rounded hover:bg-obr-paper hover:text-obr-text ${
      props.pressed ? "bg-obr-primary text-obr-primary-contrast hover:bg-obr-primary hover:text-obr-primary-contrast" : "text-obr-text-secondary"
    }`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

const IconButton = (props: ButtonProps & { disabled?: boolean }) => (
  <button
    type="button"
    aria-label={props.label}
    aria-pressed={props.pressed}
    title={props.label}
    disabled={props.disabled}
    className={`${ICON_SLOT} text-center text-xs leading-4 hover:text-obr-text disabled:opacity-30 ${
      props.pressed ? "text-obr-text" : "text-obr-text-secondary"
    }`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

// Drawn for this extension (no icon font: no third-party requests).
const SkullIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 0-8 8c0 2.7 1.3 4.7 3 5.8V19a1 1 0 0 0 1 1h1v-2h2v2h2v-2h2v2h1a1 1 0 0 0 1-1v-3.2c1.7-1.1 3-3.1 3-5.8a8 8 0 0 0-8-8zM8.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13.5l-1.2 2h2.4z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

// Bars shortening downward: the usual "sort, highest first" icon.
const SortIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 4h12M2 8h8M2 12h4" />
  </svg>
);

export default Tracker;
