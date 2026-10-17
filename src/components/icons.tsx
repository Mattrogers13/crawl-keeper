// Drawn for this extension (no icon font: no third-party requests).
export const SkullIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 0-8 8c0 2.7 1.3 4.7 3 5.8V19a1 1 0 0 0 1 1h1v-2h2v2h2v-2h2v2h1a1 1 0 0 0 1-1v-3.2c1.7-1.1 3-3.1 3-5.8a8 8 0 0 0-8-8zM8.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13.5l-1.2 2h2.4z"
    />
  </svg>
);

// A d20 face-on: the GM / Monsters initiative roll.
export const D20Icon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden>
    <path d="M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z" />
    <path d="M8 4.5l3 5H5z M8 1.5v3 M2.4 4.75L5 9.5 M13.6 4.75L11 9.5 M5 9.5L8 14.5 M11 9.5L8 14.5 M2.4 11.25L5 9.5 M13.6 11.25L11 9.5" />
  </svg>
);

// Three dots: more actions.
export const MoreIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </svg>
);

// Three lines: the usual drag handle.
export const GripIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M3 4h10M3 8h10M3 12h10" />
  </svg>
);

// A play triangle: ▶ next, ◀ back.
export const PlayIcon = ({ back = false }: { back?: boolean }) => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
    <path d={back ? "M11 2L4 8l7 6z" : "M5 2l7 6-7 6z"} />
  </svg>
);

// Bars shortening downward: the usual "sort, highest first" icon.
export const SortIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 4h12M2 8h8M2 12h4" />
  </svg>
);

// A chevron: down when open, right when folded.
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={open ? "M1.5 3.5 5 7l3.5-3.5" : "M3.5 1.5 7 5 3.5 8.5"} />
  </svg>
);
