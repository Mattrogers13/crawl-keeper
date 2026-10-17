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
  type GmDie,
  type Tracker as TrackerDoc,
} from "../tracker";

// `owner`: the player who put the token on the map.
export type Token = { name: string; image: string | null; visible: boolean; owner: string };

// What the tracker shows for a token. Items are Owlbear data: don't trust
// their shape beyond what's checked here.
export const tokenInfo = (item: Item | undefined): Token => {
  const image = (item as { image?: { url?: unknown } } | undefined)?.image?.url;
  return {
    name: item?.name?.trim() || "Unnamed",
    image: typeof image === "string" ? image : null,
    visible: item?.visible !== false,
    owner: typeof item?.createdUserId === "string" ? item.createdUserId : "",
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
  // Some row is checked: every row shows its checkbox.
  checking: boolean;
  // The monsters' initiative modifier, and the GM's last d20 while it still
  // adds up to the GM row's roll (GM row only).
  gmMod: number;
  gmDie: GmDie | null;
  // The GM row's monsters, listed under it.
  children?: ReactNode;
  // A monster under the GM row: indented, a smaller portrait.
  small?: boolean;
}) => {
  const { entry, token, gm, change } = props;
  const name = token ? token.name : "GM / Monsters";
  // Players can't drag: no grip, and the sortable is off.
  const sortable = useSortable({ id: entry.id, disabled: !gm });
  // The GM row's DEX modifier and Roll, opened from its d20.
  const [rolling, setRolling] = useState(false);
  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-current={props.current ? "step" : undefined}
      className={sortable.isDragging ? "relative z-10 bg-obr-paper shadow-lg" : ""}
    >
      <div
        className={`group flex items-center gap-2 border-b border-obr-text/10 pr-1 ${props.small ? "min-h-[34px] py-0.5" : "min-h-[44px] py-1"} ${
          gm ? "" : "pl-1"
        } ${
          props.current
            ? "bg-obr-primary/20 shadow-[inset_3px_0_0_var(--obr-primary)]"
            : props.selected
              ? "bg-obr-primary/10"
              : gm
                ? "hover:bg-obr-text/5"
                : ""
        } ${token && !token.visible ? "opacity-60" : ""} ${entry.dead ? "opacity-55" : ""}`}
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
            className={`flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-obr-text-secondary hover:text-obr-text active:cursor-grabbing ${HOVER_ONLY}`}
          >
            <GripIcon />
          </button>
        )}
        {gm && (
          <span className="flex w-4 shrink-0 justify-center">
            {token && (
              // The same selection as Cmd/Ctrl-click: one more or one less.
              <input
                type="checkbox"
                aria-label={`Select ${name}`}
                checked={props.selected}
                onChange={() => props.select(entry.id, { shift: false, toggle: true })}
                className={`h-3.5 w-3.5 cursor-pointer accent-[var(--obr-primary)] ${props.checking ? "" : HOVER_ONLY}`}
              />
            )}
          </span>
        )}
        {props.small && (
          <span className="w-3 shrink-0 text-obr-text-disabled" aria-hidden>
            └
          </span>
        )}
        {gm && token ? (
          <button type="button" aria-label={`Show ${name} on the map`} title="Show on the map" onClick={() => props.show(entry.id)}>
            <Portrait token={token} dead={entry.dead} marker={entry.marker} small={props.small} />
          </button>
        ) : (
          <Portrait token={token} dead={entry.dead} small={props.small} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate leading-tight ${props.small ? "text-[13px]" : "font-medium"} ${entry.dead ? "line-through" : ""}`}>
            {name}
            {entry.dead && <span className="sr-only"> (dead)</span>}
          </span>
          {gm ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              {!token && props.gmDie && <Equation die={props.gmDie} />}
              <NoteInput key={entry.note} name={name} value={entry.note} save={(n) => change((t) => setNote(t, entry.id, n))} />
            </span>
          ) : (
            entry.note && <span className="text-xs whitespace-pre-wrap text-obr-text-secondary">{entry.note}</span>
          )}
        </div>
        {gm ? (
          <>
            <span className={`${INIT_SLOT} flex items-center justify-end gap-1`}>
              {/* The GM row's d20, left of its roll: opens the DEX modifier and Roll. */}
              {!token && (
                <button
                  type="button"
                  aria-label="Roll initiative for GM / Monsters"
                  aria-expanded={rolling}
                  title="Roll d20 + the monsters' DEX modifier (p. 83)"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-obr-primary hover:bg-obr-primary/15 ${
                    rolling ? "bg-obr-primary/20" : ""
                  }`}
                  onClick={() => setRolling(!rolling)}
                >
                  <D20Icon />
                </button>
              )}
              {/* Monsters act on the GM / Monsters roll. */}
              {!entry.monster && (
                <RollInput key={entry.roll ?? ""} name={name} value={entry.roll} save={(r) => change((t) => setRoll(t, entry.id, r))} />
              )}
            </span>
            {/* The row menu (also on right-click). The GM row has none: a gap keeps the columns lined up. */}
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
              <span className={ROW_ACTION} aria-hidden />
            )}
          </>
        ) : (
          <span className={`${INIT_SLOT} pr-2 text-right font-mono text-base font-bold tabular-nums`}>
            {entry.monster ? "" : (entry.roll ?? "–")}
          </span>
        )}
      </div>
      {gm && !token && rolling && (
        <GmRoll
          mod={props.gmMod}
          setMod={(m) => change((t) => setGmMod(t, m))}
          roll={() => {
            change((t) => rollGmInitiative(t, cryptoRand));
            setRolling(false);
          }}
          close={() => setRolling(false)}
        />
      )}
      {props.children}
    </li>
  );
};

const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);

// `d20 12 + 2` under the GM row's name.
const Equation = ({ die }: { die: GmDie }) => (
  <span className="shrink-0 font-mono text-[11px] text-obr-text-secondary" title="The last GM / Monsters roll">
    d20 {die.die}
    {die.mod !== 0 && ` ${signed(die.mod)}`}
  </span>
);

// Under the GM row: the monsters' DEX modifier (− / box / +) and Roll.
const GmRoll = (props: { mod: number; setMod: (m: number) => void; roll: () => void; close: () => void }) => {
  const { mod, setMod } = props;
  const step = (by: number) => setMod(Math.max(MOD_MIN, Math.min(MOD_MAX, mod + by)));
  return (
    <div
      role="group"
      aria-label="GM / Monsters initiative"
      className="flex items-center gap-2 border-b border-obr-text/10 bg-obr-bg px-3 py-2 text-xs text-obr-text-secondary"
      onKeyDown={(e) => e.key === "Escape" && props.close()}
    >
      <span title="The highest DEX modifier among the monsters, added to the GM's d20 (p. 83)">Monsters' DEX</span>
      <span className="flex items-center rounded-md ring-1 ring-obr-text/15">
        <button type="button" aria-label="DEX modifier down" className="h-7 w-6 rounded-l-md hover:bg-obr-text/10" disabled={mod <= MOD_MIN} onClick={() => step(-1)}>
          −
        </button>
        <ModInput key={mod} value={mod} save={setMod} />
        <button type="button" aria-label="DEX modifier up" className="h-7 w-6 rounded-r-md hover:bg-obr-text/10" disabled={mod >= MOD_MAX} onClick={() => step(1)}>
          +
        </button>
      </span>
      <button
        type="button"
        className={`ml-auto h-7 rounded-md bg-obr-primary px-3 font-semibold text-obr-primary-contrast ${FOCUS_RING}`}
        onClick={props.roll}
      >
        Roll d20{mod !== 0 && (mod > 0 ? `+${mod}` : `−${-mod}`)}
      </button>
    </div>
  );
};

// `marker`: a gold dot (GM view) when this token gets the turn marker.
const Portrait = (props: { token: Token | null; dead: boolean; marker?: boolean; small?: boolean }) => {
  const { token, dead, marker = false } = props;
  const size = props.small ? "h-5 w-5" : "h-[26px] w-[26px]";
  return (
    <div className={`relative shrink-0 ${size}`}>
      {token?.image ? (
        <img src={token.image} alt="" className={`${size} rounded-full object-cover ${dead ? "grayscale" : ""}`} />
      ) : token ? (
        <div className={`flex ${size} items-center justify-center rounded-full bg-obr-text/10 text-[10px] font-bold`} aria-hidden>
          ?
        </div>
      ) : (
        <div className={`flex ${size} items-center justify-center rounded-full bg-obr-primary text-[10px] font-extrabold text-obr-primary-contrast`} aria-hidden>
          GM
        </div>
      )}
      {dead && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white" aria-hidden>
          <SkullIcon className={props.small ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
      )}
      {marker && (
        <span
          className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-obr-paper bg-[#c99700] dark:bg-[#f5c542]"
          title="Gets the turn marker"
          aria-label="Turn marker on"
          role="img"
        />
      )}
    </div>
  );
};

// The initiative column: the GM row's d20 and roll fit, the rest line up.
export const INIT_SLOT = "w-[72px] shrink-0";

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

// No border: a faint fill on hover, a thin primary ring while typing.
const GHOST_INPUT =
  "rounded bg-transparent hover:bg-obr-text/5 focus:bg-obr-text/5 focus:ring-1 focus:ring-obr-primary focus:outline-none";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obr-primary";

// Empty = no roll.
const readRoll = (text: string) => (text.trim() === "" ? null : (parseRoll(Number(text)) ?? undefined));

const RollInput = ({ name, value, save }: { name: string; value: number | null; save: (r: number | null) => void }) => (
  <input
    aria-label={`Initiative for ${name}`}
    inputMode="numeric"
    placeholder="–"
    className={`w-10 px-1 py-0.5 text-right font-mono text-base font-bold tabular-nums placeholder:font-normal placeholder:text-obr-text-secondary ${GHOST_INPUT}`}
    {...useDraft(value === null ? "" : String(value), readRoll, save)}
  />
);

// "+2", "-1" or "2"; empty = 0. Out of range or not a number: put it back.
const readMod = (text: string) => {
  const t = text.trim().replace("−", "-");
  if (t === "") return 0;
  if (!/^[+-]?\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n >= MOD_MIN && n <= MOD_MAX ? n : undefined;
};
const showMod = (n: number) => (n === 0 ? "" : n > 0 ? `+${n}` : String(n));

// The monsters' DEX modifier, added to the GM's d20.
const ModInput = ({ value, save }: { value: number; save: (m: number) => void }) => (
  <input
    aria-label="Monster DEX modifier"
    inputMode="numeric"
    placeholder="+0"
    className="h-7 w-8 bg-transparent text-center font-mono text-xs text-obr-text tabular-nums placeholder:text-obr-text-secondary focus:ring-1 focus:ring-obr-primary focus:outline-none"
    {...useDraft(showMod(value), readMod, save)}
  />
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
// The grip, checkbox and ⋯ show on hovering the row, or focusing them; on
// touch screens (no hover) they always show.
const HOVER_ONLY = "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

// The same width on every row (see Row).
const ROW_ACTION = "h-8 w-7 shrink-0";

const RowAction = (props: ButtonProps) => (
  <button
    type="button"
    aria-label={props.label}
    aria-pressed={props.pressed}
    title={props.label}
    className={`${ROW_ACTION} flex items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-paper hover:text-obr-text ${HOVER_ONLY}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default Row;
