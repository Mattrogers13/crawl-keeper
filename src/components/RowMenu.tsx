import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { remove, setDead, setMarker, setMonster, type Entry, type Tracker as TrackerDoc } from "../tracker";

// The GM's actions for the selected token rows (one or many). Opened by
// right-clicking a row or its ⋯ button (touch has no right-click). Closes on
// a choice, Escape, or a click elsewhere. A mixed selection offers both ways.
const RowMenu = (props: {
  entries: Entry[];
  name: string;
  x: number;
  y: number;
  close: () => void;
  change: (fn: (t: TrackerDoc) => TrackerDoc) => void;
  show: (id: string) => void;
  clear: () => void;
}) => {
  const { entries, close, change } = props;
  const ids = entries.map((e) => e.id);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: props.x, top: props.y });

  // Keep it inside the panel; focus the first item.
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(props.x, window.innerWidth - box.width - 4)),
      top: Math.max(4, Math.min(props.y, window.innerHeight - box.height - 4)),
    });
    ref.current!.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [props.x, props.y]);

  useEffect(() => {
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [close]);

  // [label, shown?, action]
  const some = (f: (e: Entry) => boolean) => entries.some(f);
  const items: [string, boolean, () => void][] = [
    ["Mark as monster", some((e) => !e.monster), () => change((t) => setMonster(t, ids, true))],
    ["Mark as player or ally", some((e) => e.monster), () => change((t) => setMonster(t, ids, false))],
    ["Mark dead", some((e) => !e.dead), () => change((t) => setDead(t, ids, true))],
    ["Mark alive", some((e) => e.dead), () => change((t) => setDead(t, ids, false))],
    ["Turn marker on", some((e) => !e.marker), () => change((t) => setMarker(t, ids, true))],
    ["Turn marker off", some((e) => e.marker), () => change((t) => setMarker(t, ids, false))],
    ["Show on map", ids.length === 1, () => props.show(ids[0])],
    [
      ids.length === 1 ? "Remove from initiative" : `Remove ${ids.length} from initiative`,
      true,
      () => {
        change((t) => remove(t, ids));
        props.clear();
      },
    ],
  ];
  // Up / Down move between items.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") return close();
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...ref.current!.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={props.name}
      style={pos}
      className="fixed z-50 flex min-w-44 flex-col rounded-lg bg-obr-paper py-1 text-sm shadow-xl ring-1 ring-obr-text/10"
      onKeyDown={onKeyDown}
    >
      {items
        .filter(([, shown]) => shown)
        .map(([label, , run]) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          className="px-3 py-2 text-left hover:bg-obr-text/5 focus:bg-obr-text/10 focus:outline-none"
          onClick={() => {
            run();
            close();
          }}
        >
          {label}
        </button>
        ))}
    </div>
  );
};

export default RowMenu;
