// One tracker row (token, or the GM / Monsters row with its monsters under
// it) and its in-place inputs: roll, note, the monsters' DEX modifier.
import { useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { type Item } from "@owlbear-rodeo/sdk";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cryptoRand } from "../crawl";
import { D20Icon, GripIcon, MoreIcon, SkullIcon } from "./icons";
import {
  MOD_MAX,
  MOD_MIN,
  NOTE_MAX,
  parseRoll,
  rollGmInitiative,
  setGmMod,
  setNote,
  setRoll,
  type Entry,
  type Tracker as TrackerDoc,
} from "../tracker";

export type Token = { name: string; image: string | null; visible: boolean };

// What the tracker shows for a token. Items are Owlbear data: don't trust
// their shape beyond what's checked here.
export const tokenInfo = (item: Item | undefined): Token => {
  const image = (item as { image?: { url?: unknown } } | undefined)?.image?.url;
  return {
    name: item?.name?.trim() || "Unnamed",
    image: typeof image === "string" ? image : null,
    visible: item?.visible !== false,
  };
};

const Row = (props: {
  entry: Entry;
  token: Token | null;
  current: boolean;
  gm: boolean;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
  show: (id: string) => void;
  openMenu: (id: string, x: number, y: number) => void;
  select: (id: string, mods: { shift: boolean; toggle: boolean }) => void;
  selected: boolean;
  // The monsters' initiative modifier (shown on the GM row).
  gmMod: number;
  // The GM row's crawl card and monsters, listed under it.
  children?: ReactNode;
  // The GM row with monsters: one card holds the group.
  bracket?: boolean;
  // A monster inside that card: a smaller portrait.
  small?: boolean;
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
      // The GM row and its monsters share one card instead of an indent (an
      // indent squeezes the monsters' notes).
      className={`${sortable.isDragging ? "relative z-10 rounded-lg bg-obr-paper shadow-lg" : ""} ${
        props.bracket ? "flex flex-col gap-0.5 rounded-[10px] bg-obr-bg p-1" : ""
      }`}
    >
      <div
        className={`group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${
          props.current ? "bg-obr-primary/20 shadow-[inset_3px_0_0_var(--obr-primary)]" : gm ? "hover:bg-obr-text/5" : ""
        } ${token && !token.visible ? "opacity-60" : ""} ${
          entry.dead ? "opacity-55" : ""
        } ${props.selected ? "outline-2 -outline-offset-2 outline-obr-secondary outline-dashed" : ""}`}
        aria-selected={gm && token ? props.selected : undefined}
        // GM: click to select (Shift: a range, Cmd/Ctrl: one more), except on
        // the row's own boxes and buttons.
        onClick={
          gm && token
            ? (e) => {
                if ((e.target as HTMLElement).closest("input, button")) return;
                props.select(entry.id, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
              }
            : undefined
        }
        // GM: right-click a token's row for its menu.
        onContextMenu={
          gm && token
            ? (e) => {
                e.preventDefault();
                props.openMenu(entry.id, e.clientX, e.clientY);
              }
            : undefined
        }
      >
        {gm && (
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`Move ${name}`}
            title="Drag to move"
            className={`flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-obr-text-secondary hover:text-obr-text active:cursor-grabbing ${HOVER_ONLY}`}
          >
            <GripIcon />
          </button>
        )}
        {gm && token ? (
          <button type="button" aria-label={`Show ${name} on the map`} title="Show on the map" onClick={() => props.show(entry.id)}>
            <Portrait token={token} dead={entry.dead} marker={entry.marker} small={props.small} />
          </button>
        ) : (
          <Portrait token={token} dead={entry.dead} small={props.small} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-medium ${entry.dead ? "line-through" : ""}`}>
            {name}
            {entry.dead && <span className="sr-only"> (dead)</span>}
          </span>
          {gm ? (
            <NoteInput key={entry.note} name={name} value={entry.note} save={(n) => change((t) => setNote(t, entry.id, n))} />
          ) : (
            entry.note && <span className="text-xs whitespace-pre-wrap text-obr-text-secondary">{entry.note}</span>
          )}
        </div>
        {gm ? (
          <>
            {/* Monsters act on the GM / Monsters roll: a gap keeps the columns lined up. */}
            {!token && <ModInput key={props.gmMod} value={props.gmMod} save={(m) => change((t) => setGmMod(t, m))} />}
            {entry.monster ? (
              <span className={ROLL_SLOT} aria-hidden />
            ) : (
              <RollInput key={entry.roll ?? ""} name={name} value={entry.roll} save={(r) => change((t) => setRoll(t, entry.id, r))} />
            )}
            {/* The row menu (also on right-click). The GM row has none: a gap keeps the roll boxes lined up. */}
            {token ? (
              <RowAction
                label={`Actions for ${name}`}
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  props.openMenu(entry.id, box.left, box.bottom);
                }}
              >
                <MoreIcon />
              </RowAction>
            ) : (
              <RowAction
                label="Roll initiative for GM / Monsters (d20 + modifier)"
                onClick={() => change((t) => rollGmInitiative(t, cryptoRand))}
                always
              >
                <D20Icon />
              </RowAction>
            )}
          </>
        ) : (
          <span className="w-10 text-right text-lg font-bold tabular-nums">{entry.monster ? "" : (entry.roll ?? "–")}</span>
        )}
      </div>
      {props.children}
    </li>
  );
};

// `marker`: a gold dot (GM view) when this token gets the turn marker.
const Portrait = (props: { token: Token | null; dead: boolean; marker?: boolean; small?: boolean }) => {
  const { token, dead, marker = false } = props;
  const size = props.small ? "h-[30px] w-[30px]" : "h-9 w-9";
  return (
    <div className={`relative shrink-0 ${size}`}>
      {token?.image ? (
        <img src={token.image} alt="" className={`${size} rounded-full object-cover ${dead ? "grayscale" : ""}`} />
      ) : (
        <div className={`flex ${size} items-center justify-center rounded-full bg-obr-text/10 text-xs font-bold`} aria-hidden>
          {token ? "?" : "GM"}
        </div>
      )}
      {dead && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white" aria-hidden>
          <SkullIcon className="h-6 w-6" />
        </span>
      )}
      {marker && (
        <span
          className="absolute -right-px -bottom-px h-[11px] w-[11px] rounded-full border-2 border-obr-paper bg-[#c99700] dark:bg-[#f5c542]"
          title="Gets the turn marker"
          aria-label="Turn marker on"
          role="img"
        />
      )}
    </div>
  );
};

const ROLL_SLOT = "w-12 shrink-0";

// A text box that saves on Enter or when focus leaves. `read` turns the text
// into a value, or undefined when it can't (the box then puts the old text
// back). Unchanged text saves nothing.
const useDraft = <T,>(shown: string, read: (text: string) => T | undefined, save: (value: T) => void) => {
  const [draft, setDraft] = useState(shown);
  return {
    value: draft,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: () => {
      if (draft === shown) return;
      const value = read(draft);
      // Saved or not, show it the way it's stored ("3" → "+3"); a change
      // remounts the box with the new value anyway (keyed by it).
      if (value !== undefined) save(value);
      setDraft(shown);
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur(),
  };
};

// Borderless until hovered or focused.
const GHOST_INPUT =
  "rounded border border-transparent bg-transparent hover:border-obr-text-disabled focus:border-obr-primary focus:outline-none";

// Empty = no roll.
const readRoll = (text: string) => (text.trim() === "" ? null : (parseRoll(Number(text)) ?? undefined));

const RollInput = ({ name, value, save }: { name: string; value: number | null; save: (r: number | null) => void }) => (
  <input
    aria-label={`Initiative for ${name}`}
    inputMode="numeric"
    placeholder="–"
    className={`${ROLL_SLOT} px-1 py-0.5 text-right text-lg font-bold tabular-nums placeholder:font-normal placeholder:text-obr-text-secondary ${GHOST_INPUT}`}
    {...useDraft(value === null ? "" : String(value), readRoll, save)}
  />
);

// "+2", "-1" or "2"; empty = 0. Out of range or not a number: put it back.
const readMod = (text: string) => {
  const t = text.trim();
  if (t === "") return 0;
  if (!/^[+-]?\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n >= MOD_MIN && n <= MOD_MAX ? n : undefined;
};
const showMod = (n: number) => (n === 0 ? "" : n > 0 ? `+${n}` : String(n));

// The monsters' DEX modifier, added to the GM's d20.
const ModInput = ({ value, save }: { value: number; save: (m: number) => void }) => (
  <label className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-obr-text-secondary uppercase">
    Dex
    <input
      aria-label="Monster DEX modifier"
      title="The highest DEX modifier among the monsters, added to the GM's d20 (p. 83)"
      inputMode="numeric"
      placeholder="+0"
      className="h-7 w-9 rounded-full bg-transparent px-1 text-center text-xs tabular-nums ring-1 ring-obr-text/15 placeholder:text-obr-text-secondary hover:ring-obr-text/30 focus:ring-2 focus:ring-obr-primary focus:outline-none"
      {...useDraft(showMod(value), readMod, save)}
    />
  </label>
);

const NoteInput = ({ name, value, save }: { name: string; value: string; save: (n: string) => void }) => (
  <input
    aria-label={`Note for ${name}`}
    placeholder="Add a note"
    maxLength={NOTE_MAX}
    // The placeholder shows on hover or focus only: a column of "Add a note" crowds the list.
    className={`-ml-1 w-full min-w-0 px-1 text-xs text-obr-text-secondary placeholder:text-obr-text-secondary [@media(hover:hover)]:placeholder:opacity-0 group-hover:placeholder:opacity-100 focus:placeholder:opacity-100 ${GHOST_INPUT}`}
    {...useDraft(value, (text) => text, save)}
  />
);

export type ButtonProps = { label: string; pressed?: boolean; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode };
// The grip and ⋯ show on hovering the row, or focusing them; on touch screens
// (no hover) they always show.
const HOVER_ONLY = "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

// Dead and remove: full-size touch targets, the same width on every row (see Row).
const ROW_ACTION = "h-9 w-9 shrink-0";

// `always`: shown without hovering (the GM row's roll).
const RowAction = (props: ButtonProps & { always?: boolean }) => (
  <button
    type="button"
    aria-label={props.label}
    aria-pressed={props.pressed}
    title={props.label}
    className={`${ROW_ACTION} flex items-center justify-center rounded-full hover:bg-obr-paper hover:text-obr-text ${props.always ? "" : HOVER_ONLY} ${
      props.pressed ? "bg-obr-primary text-obr-primary-contrast hover:bg-obr-primary hover:text-obr-primary-contrast" : "text-obr-text-secondary"
    }`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default Row;
