import { useState, type ReactNode } from "react";
import type { Item } from "@owlbear-rodeo/sdk";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import Loading from "./Loading";
import { SETTINGS_KEY, TRACKER_KEY } from "../constants";
import type { Role } from "../hooks/useRole";
import { useRoomValue, useSceneValue } from "../hooks/useRoomValue";
import { useSceneItems } from "../hooks/useScene";
import { syncTurn } from "../marker";
import { parseSettings } from "../settings";
import { errorMessage, notify } from "../utils";
import {
  GM_ENTRY,
  NOTE_MAX,
  ROLL_MAX,
  ROLL_MIN,
  hpFromInput,
  moveTo,
  next,
  parseTracker,
  phaseRound,
  previous,
  prune,
  resetRounds,
  remove,
  setDead,
  setHp,
  setNote,
  setRoll,
  sortByRoll,
  toCombat,
  toCrawl,
  type Entry,
  type Hp,
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
  // Drag rows by the grip (mouse, touch), or focus the grip and use Space +
  // arrow keys.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!settings.loaded || !doc.loaded || items === null) return <Loading />;

  const byId = new Map(items.map((i) => [i.id, i]));
  // Tokens deleted from the map drop out. Writes save this pruned version.
  const tracker = prune(doc.value, (id) => byId.has(id));
  const gm = role === "GM";

  // Every GM edit: apply a pure change and save it if anything changed. A
  // new turn also moves the marker and the selection (GM clicks only; see
  // marker.ts).
  const change = (fn: (t: TrackerDoc) => TrackerDoc) => {
    const updated = fn(tracker);
    if (updated === doc.value) return;
    void doc.write(updated);
    if (updated.current !== tracker.current) {
      syncTurn(updated.current, settings.value).catch((err) =>
        notify(`Couldn't move the turn marker: ${errorMessage(err)}`, "WARNING"),
      );
    }
  };

  // Players never see hidden tokens. If it's a hidden token's turn, players
  // see the GM row as current instead.
  const shown = gm
    ? tracker.entries
    : tracker.entries.filter((e) => e.id === GM_ENTRY || tokenInfo(byId.get(e.id)).visible);
  const current = gm || shown.some((e) => e.id === tracker.current) ? tracker.current : tracker.current && GM_ENTRY;
  const top = shown.filter((e) => !e.monster);
  const monsters = shown.filter((e) => e.monster);
  const tokenFor = (e: Entry) => (e.id === GM_ENTRY ? null : tokenInfo(byId.get(e.id)));
  const round = phaseRound(tracker);
  const roundLabel =
    round === 0 ? (gm ? "Press ▶ to begin" : "") : gm || !settings.value.hideRound ? `Round ${round}` : "";
  const combat = tracker.phase === "combat";
  const drop = ({ active, over }: DragEndEvent) => {
    if (over) change((t) => moveTo(t, String(active.id), String(over.id)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {gm ? (
          <div role="group" aria-label="Phase" className="flex overflow-hidden rounded border border-obr-text-disabled text-sm font-medium">
            <button
              type="button"
              aria-pressed={!combat}
              className={`px-2 py-0.5 ${combat ? "" : "bg-obr-primary text-obr-primary-contrast"}`}
              onClick={() => change(toCrawl)}
            >
              Crawl
            </button>
            <button
              type="button"
              aria-pressed={combat}
              className={`px-2 py-0.5 ${combat ? "bg-red-700 text-white" : ""}`}
              onClick={() => change((t) => toCombat(t, settings.value.clearRollsOnCombat))}
            >
              Combat
            </button>
          </div>
        ) : (
          <h2 className={`font-semibold ${combat ? "text-red-500" : ""}`}>{combat ? "Combat" : "Crawl"}</h2>
        )}
        {roundLabel && <span className="text-sm text-obr-text-secondary">{roundLabel}</span>}
        {gm && (
          <div className="ml-auto flex gap-1">
            <Button label="Previous turn" disabled={tracker.current === null} onClick={() => change(previous)}>
              ◀
            </Button>
            <Button label="Next turn" primary onClick={() => change(next)}>
              ▶
            </Button>
          </div>
        )}
      </div>

      {gm && (
        <div className="flex items-center gap-2 text-sm">
          <Button label="Sort by roll" onClick={() => change(sortByRoll)}>
            <SortIcon />
          </Button>
          <ResetRounds reset={() => change(resetRounds)} />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={drop}
      >
        {/* Two drag groups: players and the GM row; monsters inside the GM row. */}
        <SortableContext items={top.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1">
            {top.map((entry) => (
              <Row key={entry.id} entry={entry} token={tokenFor(entry)} current={entry.id === current} gm={gm} change={change}>
                {entry.id === GM_ENTRY && monsters.length > 0 && (
                  <SortableContext items={monsters.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <ol aria-label="Monsters" className="mt-1 ml-6 flex flex-col gap-1">
                      {monsters.map((m) => (
                        <Row key={m.id} entry={m} token={tokenFor(m)} current={m.id === current} gm={gm} change={change} />
                      ))}
                    </ol>
                  </SortableContext>
                )}
              </Row>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {gm && tracker.entries.length === 1 && (
        <p className="text-sm text-obr-text-secondary">
          Right-click a token: “Add / Remove Initiative” for players, “Add / Remove Monster” for monsters.
        </p>
      )}
    </div>
  );
};

// Asks before resetting: a stray click would lose the crawl round count,
// which the encounter checks run on.
const ResetRounds = ({ reset }: { reset: () => void }) => {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="ml-auto text-xs text-obr-text-secondary underline hover:text-obr-text" onClick={() => setAsking(true)}>
        Reset rounds
      </button>
    );
  return (
    <div role="alertdialog" aria-label="Reset rounds?" className="ml-auto flex items-center gap-1 text-xs">
      <span>Reset both round counts to 0?</span>
      <button
        type="button"
        className="rounded bg-red-700 px-2 py-0.5 font-medium text-white"
        onClick={() => {
          reset();
          setAsking(false);
        }}
      >
        Reset
      </button>
      <button type="button" className="rounded border border-obr-text-disabled px-2 py-0.5" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
};

const Row = (props: {
  entry: Entry;
  token: Token | null;
  current: boolean;
  gm: boolean;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
  // The GM row's monsters, listed under it.
  children?: ReactNode;
}) => {
  const { entry, token, gm, change } = props;
  const name = token ? token.name : "GM / Monsters";
  // Players can't drag: no grip, and the sortable is off.
  const sortable = useSortable({ id: entry.id, disabled: !gm });
  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-current={props.current ? "step" : undefined}
      className={sortable.isDragging ? "relative z-10 shadow-lg" : ""}
    >
      <div
        className={`flex items-start gap-2 rounded p-1.5 ${props.current ? "bg-obr-primary/20 ring-1 ring-obr-primary" : "bg-obr-bg"} ${
          token && !token.visible ? "opacity-60" : ""
        }`}
      >
        {gm && (
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`Move ${name}`}
            title="Drag to move"
            className="flex h-9 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-obr-text-secondary hover:text-obr-text active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}
        <Portrait token={token} dead={entry.dead} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-medium ${entry.dead ? "text-obr-text-secondary line-through" : ""}`}>
            {name}
            {entry.dead && <span className="sr-only"> (dead)</span>}
          </span>
          {gm ? (
            <div className="flex items-center gap-1">
              <NoteInput key={entry.note} name={name} value={entry.note} save={(n) => change((t) => setNote(t, entry.id, n))} />
              {entry.monster && <HpInputs name={name} hp={entry.hp} save={(hp) => change((t) => setHp(t, entry.id, hp))} />}
            </div>
          ) : (
            entry.note && <span className="text-sm whitespace-pre-wrap text-obr-text-secondary">{entry.note}</span>
          )}
        </div>
        {gm ? (
          <>
            {/* Monsters act on the GM / Monsters roll: a gap keeps the columns lined up. */}
            {entry.monster ? (
              <span className={ROLL_SLOT} aria-hidden />
            ) : (
              <RollInput key={entry.roll ?? ""} name={name} value={entry.roll} save={(r) => change((t) => setRoll(t, entry.id, r))} />
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
          <span className="w-10 text-right tabular-nums">{entry.monster ? "" : (entry.roll ?? "–")}</span>
        )}
      </div>
      {props.children}
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

const ROLL_SLOT = "w-12 shrink-0";

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
      className={`${ROLL_SLOT} rounded border border-obr-text-disabled bg-obr-paper px-1 py-0.5 text-right tabular-nums focus:border-obr-primary focus:outline-none`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
};

// GM-only. Current HP takes "-5" (damage), "+3" (healing) or a number; max
// empty stops tracking. Unreadable input puts the old value back.
const HpInputs = ({ name, hp, save }: { name: string; hp: Hp | null; save: (hp: Hp | null) => void }) => (
  <span className="flex shrink-0 items-center gap-0.5 text-xs text-obr-text-secondary">
    HP
    <HpBox key={`cur-${hp?.cur}`} label={`HP for ${name}`} box="cur" hp={hp} save={save} />/
    <HpBox key={`max-${hp?.max}`} label={`Max HP for ${name}`} box="max" hp={hp} save={save} />
  </span>
);

const HpBox = (props: { label: string; box: "cur" | "max"; hp: Hp | null; save: (hp: Hp | null) => void }) => {
  const shown = props.hp === null ? "" : String(props.hp[props.box]);
  const [draft, setDraft] = useState(shown);
  const commit = () => {
    if (draft === shown) return;
    const hp = hpFromInput(props.hp, props.box, draft);
    if (hp === undefined) setDraft(shown);
    else props.save(hp);
  };
  return (
    <input
      aria-label={props.label}
      inputMode="numeric"
      className={`w-9 rounded border border-transparent bg-transparent px-0.5 text-right tabular-nums hover:border-obr-text-disabled focus:border-obr-primary focus:outline-none ${
        props.box === "cur" && props.hp?.cur === 0 ? "font-semibold text-red-500" : "text-obr-text"
      }`}
      placeholder="–"
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
      className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-sm text-obr-text-secondary hover:border-obr-text-disabled focus:border-obr-primary focus:outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && save(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
};

type ButtonProps = { label: string; pressed?: boolean; onClick: () => void; children: ReactNode };

const Button = ({ label, primary, pressed, disabled, onClick, children }: ButtonProps & { primary?: boolean; disabled?: boolean }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={pressed}
    title={label}
    disabled={disabled}
    className={`flex min-h-6 items-center rounded px-2 py-0.5 text-sm font-medium disabled:opacity-40 ${
      primary || pressed ? "bg-obr-primary text-obr-primary-contrast" : "border border-obr-text-disabled"
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

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

// Three lines: the usual drag handle.
const GripIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M3 4h10M3 8h10M3 12h10" />
  </svg>
);

// Bars shortening downward: the usual "sort, highest first" icon.
const SortIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 4h12M2 8h8M2 12h4" />
  </svg>
);

export default Tracker;
