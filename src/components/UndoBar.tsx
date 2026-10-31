import { useEffect, useRef, useState, type ReactNode } from "react";

import { FOCUS } from "./CrawlBar";
import { UndoIcon } from "./icons";
import type { History } from "../history";
import { loadHistory, onHistoryChange, redo, undo } from "../undo";

export const TOAST_MS = 8000;

// The GM's Undo / Redo, on every screen of the panel (docs/design.md, global
// undo). The buttons name the step; Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z
// (or Ctrl+Y) redoes while the panel has focus, except while typing (fields
// keep their own text undo). After a bigger action a toast offers Undo for
// a few seconds: the same undo, not a second one.
const UndoBar = () => {
  const [history, setHistory] = useState<History>(loadHistory);
  const [toast, setToast] = useState<string | null>(null);
  // Steps already seen, so a redone step (back on the stack) doesn't toast.
  const seen = useRef(new Set(history.undo.map((s) => s.id)));

  useEffect(
    () =>
      onHistoryChange(() => {
        const h = loadHistory();
        setHistory(h);
        const top = h.undo[h.undo.length - 1];
        const fresh = top && !seen.current.has(top.id);
        h.undo.forEach((s) => seen.current.add(s.id));
        // Any other step, Undo or Redo dismisses it.
        setToast(fresh && top.toast ? top.label : null);
      }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

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
  if (!lastUndo && !lastRedo && !toast) return null;

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-2 text-xs">
        <StepButton label={lastUndo && `Undo: ${lastUndo.label}`} idle="Nothing to undo" hint="⌘Z" onClick={() => void undo()}>
          <UndoIcon />
          <span className="truncate">{lastUndo ? `Undo: ${lastUndo.label}` : "Undo"}</span>
        </StepButton>
        <StepButton label={lastRedo && `Redo: ${lastRedo.label}`} idle="Nothing to redo" hint="⇧⌘Z" onClick={() => void redo()}>
          <UndoIcon redo />
          <span className="truncate">{lastRedo ? `Redo: ${lastRedo.label}` : "Redo"}</span>
        </StepButton>
      </div>
      {toast && lastUndo && (
        <div
          role="status"
          className="absolute inset-x-0 bottom-full z-20 mb-2 flex items-center gap-3 rounded-xl bg-obr-paper px-3 py-2 text-sm shadow-lg ring-1 ring-obr-text/15"
        >
          {/* Just above the Undo bar, over the list. */}
          <span className="min-w-0 flex-1 truncate">
            <span className="text-obr-text-secondary">Done: </span>
            {toast}
          </span>
          <button
            type="button"
            className={`rounded-md px-2 py-1 font-semibold text-obr-primary hover:bg-obr-primary/10 ${FOCUS}`}
            onClick={() => void undo()}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

// A pill like the turn bar's buttons, so it reads as a button; faded and
// disabled when there's nothing to undo or redo.
const StepButton = (props: { label: string | undefined; idle: string; hint: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-label={props.label ?? props.idle}
    title={props.label ? `${props.label} (${props.hint})` : undefined}
    disabled={!props.label}
    className={`flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-obr-bg px-3 font-medium text-obr-text ring-1 ring-obr-text/15 ring-inset enabled:hover:bg-obr-text/10 disabled:opacity-40 ${FOCUS}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

export default UndoBar;
