// Identical monsters as one line under the GM row (src/stacks.ts): "Goblin
// ×4", what's on them (dead, effect icons), and › to list them. The GM's
// right-click or ⋯ on the line opens the row menu for all of them (Mark
// dead, Remove…); to act on one goblin, open the stack. Open while one of
// them has the turn.
import type { ReactNode } from "react";

import { ChevronIcon, MoreIcon } from "./icons";
import { HpInput, INIT_SLOT, NO_CHECKBOX, RowAction, type Token } from "./TrackerRow";

const MonsterStack = (props: {
  name: string;
  tokens: (Token | null)[];
  dead: number;
  // Effect icon names on any of them (each once).
  icons: string[];
  open: boolean;
  // A member has the turn: open, and it can't fold.
  current: boolean;
  toggle: () => void;
  gm: boolean;
  // GM: the box for all of them (applyHpText on each one): the living
  // members' total as shown, whether typed text is one, and saving it.
  hp?: { shown: string; valid: (text: string) => boolean; save: (text: string) => void };
  // GM: the row menu for every member, at the point.
  openMenu?: (x: number, y: number) => void;
  children: ReactNode;
}) => {
  const count = props.tokens.length;
  const image = props.tokens.find((t) => t?.image)?.image ?? null;
  const label = `${props.name} ×${count}`;
  return (
    <li>
      <div
        className={`group flex min-h-[34px] items-center gap-2 border-b border-obr-text/10 py-0.5 pr-1 ${props.gm ? "hover:bg-obr-text/5" : "pl-1"} ${props.open ? "bg-obr-text/5" : ""}`}
        onContextMenu={
          props.openMenu
            ? (e) => {
                e.preventDefault();
                props.openMenu!(e.clientX, e.clientY);
              }
            : undefined
        }
      >
        {/* Lines up with the monster rows: the grip's and checkbox's room. */}
        {props.gm && <span className="w-4 shrink-0" aria-hidden />}
        {props.gm && <span className={`w-4 shrink-0 ${NO_CHECKBOX}`} aria-hidden />}
        <span className="w-3 shrink-0 text-obr-text-disabled" aria-hidden>
          └
        </span>
        <button
          type="button"
          aria-expanded={props.open}
          aria-label={props.open ? `Fold ${label}` : `Show ${label}`}
          disabled={props.current}
          title={props.current ? "Shown while one of them has the turn" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${props.open ? "opacity-60" : ""}`}
          onClick={props.toggle}
        >
          {image ? (
            <img src={image} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-full bg-obr-text/30" />
          )}
          <span className="truncate text-[13px] leading-tight">
            {props.name} <span className="font-mono text-obr-text-secondary">×{count}</span>
          </span>
          {(props.dead > 0 || props.icons.length > 0) && (
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-obr-text-secondary">
              {props.dead > 0 && <span className="whitespace-nowrap">{props.dead} dead</span>}
              {props.icons.slice(0, 4).map((i) => (
                <img key={i} src={`/img/effect-${i}.webp`} alt="" aria-hidden className="h-3.5 w-3.5 rounded-full" />
              ))}
            </span>
          )}
          <span className="ml-auto text-obr-text-secondary">
            <ChevronIcon open={props.open} />
          </span>
        </button>
        {props.hp && (
          <span className={`${INIT_SLOT} flex items-center justify-end`}>
            <HpInput key={props.hp.shown} stack name={props.name} {...props.hp} />
          </span>
        )}
        {props.openMenu ? (
          <RowAction
            label={`More for ${label}`}
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              props.openMenu!(box.left, box.bottom);
            }}
          >
            <MoreIcon />
          </RowAction>
        ) : (
          props.gm && <span className="h-8 w-7 shrink-0" aria-hidden />
        )}
      </div>
      {props.open && (
        <ol aria-label={label} className="flex flex-col border-l-2 border-obr-text/15 ml-3">
          {props.children}
        </ol>
      )}
    </li>
  );
};

export default MonsterStack;
