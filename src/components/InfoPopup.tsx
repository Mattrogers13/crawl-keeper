import { useEffect, useRef, useState, type ReactNode } from "react";

// A small (i) button that opens the long explanation in a popup, so rules
// and fine print don't sit in the panel as noise (Matt, 2026-11-07). Escape,
// the close button or a click outside closes it.
const InfoPopup = (props: { label: string; title: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-label={props.label}
        title={props.label}
        aria-haspopup="dialog"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-obr-text-secondary ring-1 ring-obr-text/20 ring-inset hover:bg-obr-text/10 hover:text-obr-text focus-visible:outline-2 focus-visible:outline-obr-primary"
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-10" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={box}
            role="dialog"
            aria-label={props.title}
            tabIndex={-1}
            className="flex max-h-full w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-xl bg-obr-paper p-4 text-sm shadow-xl ring-1 ring-obr-text/10 focus:outline-none"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{props.title}</h2>
              <button type="button" aria-label="Close" className="h-7 rounded-md px-2.5 text-xs font-medium ring-1 ring-obr-text/15 ring-inset hover:bg-obr-text/10" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {props.children}
          </div>
        </div>
      )}
    </>
  );
};

export default InfoPopup;
