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

// The GM / Monsters portrait: a hooded figure in the dark, eyes lit. Drawn
// for this extension; fills its round frame.
export const GmPortrait = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <circle cx="12" cy="12" r="12" className="fill-obr-primary" />
    <path d="M12 3.5c-4.3 0-7.3 3.7-7.3 8.6 0 3.3-.7 5.6-2 7.4A12 12 0 0 0 21.3 19.5c-1.3-1.8-2-4.1-2-7.4 0-4.9-3-8.6-7.3-8.6z" fill="#1d1630" />
    <path d="M12 7.6c-2.6 0-4.3 2.3-4.3 5.3v2.7c1.2.9 2.6 1.4 4.3 1.4s3.1-.5 4.3-1.4v-2.7c0-3-1.7-5.3-4.3-5.3z" fill="#08060d" />
    <circle cx="10.3" cy="12.4" r="0.95" fill="#ffcf5a" />
    <circle cx="13.7" cy="12.4" r="0.95" fill="#ffcf5a" />
  </svg>
);

// A small flame: a token with a light burning (Torchlight). `spell`: the
// Light spell, a cool white glow instead of fire.
export const FlameIcon = ({ spell = false }: { spell?: boolean }) => (
  <svg viewBox="0 0 14 18" className="h-3.5 w-3" aria-hidden>
    <path d="M7 1c2 3 5 4.5 5 8.5a5 5 0 0 1-10 0c0-2.4 1.2-3.7 2.4-4.8C4.6 7 5.6 8 6.6 8 6.4 5.6 5.6 3.4 7 1z" fill={spell ? "#9cc4ff" : "#ff9a3c"} />
    <path d="M7 7.5c1.2 2 2.4 2.8 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.3 1.2-2.6 2.4-4.6z" fill={spell ? "#eef5ff" : "#ffe08a"} />
  </svg>
);
