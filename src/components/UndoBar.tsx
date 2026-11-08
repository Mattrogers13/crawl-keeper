import { useEffect, useState, type ReactNode } from "react";

import { FOCUS } from "./CrawlBar";
import { UndoIcon } from "./icons";
import type { History } from "../history";
import { loadHistory, onHistoryChange, redo, undo } from "../undo";

// The GM's Undo / Redo, on every screen of the panel (docs/design.md, global
// undo). The buttons name the step; Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z
// (or Ctrl+Y) redoes while the panel has focus, except while typing (fields
// keep their own text undo). No toast: the bar already names the step
// (Matt, 2026-11-08: "We don't need this double undo").
const UndoBar = () => {
  const [history, setHistory] = useState<History>(loadHistory);
  useEffect(() => onHistoryChange(() => setHistory(loadHistory())), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isRedo = (key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey && !e.shiftKey);
      const isUndo = key === "z" && !e.shiftKey;
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      void (isRedo ? redo() : undo());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const lastUndo = history.undo[history.undo.length - 1];
  const lastRedo = history.redo[history.redo.length - 1];
  if (!lastUndo && !lastRedo) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <StepButton label={lastUndo && `Undo: ${lastUndo.label}`} idle="Nothing to undo" hint="⌘Z" onClick={() => void undo()}>
        <UndoIcon />
        <span className="truncate">{lastUndo ? `Undo: ${lastUndo.label}` : "Undo"}</span>
      </StepButton>
      {/* Redo is rare (only right after an Undo): an icon, its tooltip
          names the step (UI review, Matt, 2026-11-08: trying this first). */}
      <StepButton label={lastRedo && `Redo: ${lastRedo.label}`} idle="Nothing to redo" hint="⇧⌘Z" onClick={() => void redo()} icon>
        <UndoIcon redo />
      </StepButton>
    </div>
  );
};

// A pill like the turn bar's buttons, so it reads as a button; faded and
// disabled when there's nothing to undo or redo.
const StepButton = (props: { label: string | undefined; idle: string; hint: string; onClick: () => void; icon?: boolean; children: ReactNode }) => (
  <button
    type="button"
    aria-label={props.label ?? props.idle}
    title={props.label ? `${props.label} (${props.hint})` : undefined}
    disabled={!props.label}
    className={`flex h-8 items-center justify-center gap-1.5 rounded-full bg-obr-bg ${props.icon ? "w-8 shrink-0" : "min-w-0 px-3"} font-medium text-obr-text ring-1 ring-obr-text/15 ring-inset enabled:hover:bg-obr-text/10 disabled:opacity-40 ${FOCUS}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default UndoBar;
