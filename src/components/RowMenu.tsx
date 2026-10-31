import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import type { Change } from "./Tracker";
import type { LightChange } from "../hooks/useLights";
import { LIGHT_KINDS, addLight, litOn, swapLight, type LightKind, type Lights } from "../lights";
import { GM_ENTRY, remove, setDead, setMarker, setMonster, type Entry } from "../tracker";

// What a row can be given (a campfire goes on any token from the map's
// right-click menu instead: docs/design.md).
const GIVEN: LightKind[] = ["torch", "lantern", "lightSpell"];
const lower = (kind: LightKind) => (kind === "lightSpell" ? "Light spell" : LIGHT_KINDS[kind].label.toLowerCase());

// The GM's actions for the selected token rows (one or many). Opened by
// right-clicking a row or its ⋯ button (touch has no right-click). Closes on
// a choice, Escape, or a click elsewhere. A mixed selection offers both ways.
const RowMenu = (props: {
  entries: Entry[];
  name: string;
  x: number;
  y: number;
  close: () => void;
  change: Change;
  // The light timers, once loaded.
  lights: { lights: Lights; change: LightChange } | null;
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
    ["Mark as monster", some((e) => !e.monster), () => change("Mark as monster", (t) => setMonster(t, ids, true))],
    ["Mark as player or ally", some((e) => e.monster), () => change("Mark as player or ally", (t) => setMonster(t, ids, false))],
    ["Mark dead", some((e) => !e.dead), () => change("Mark dead", (t) => setDead(t, ids, true))],
    ["Mark alive", some((e) => e.dead), () => change("Mark alive", (t) => setDead(t, ids, false))],
    ["Turn marker on", some((e) => !e.marker), () => change("Turn marker on", (t) => setMarker(t, ids, true))],
    ["Turn marker off", some((e) => e.marker), () => change("Turn marker off", (t) => setMarker(t, ids, false))],
    ["Show on map", ids.length === 1, () => props.show(ids[0])],
    ...giveLight(),
    [
      ids.length === 1 ? "Remove from initiative" : `Remove ${ids.length} from initiative`,
      true,
      () => {
        change("Remove from initiative", (t) => remove(t, ids), { toast: true });
        props.clear();
      },
    ],
  ];
  // One token: Give torch / lantern / Light spell. A token holds one lit
  // light (p. 84), so with one already lit the item says the swap: "Put out
  // the torch, light the lantern".
  function giveLight(): [string, boolean, () => void][] {
    const l = props.lights;
    const id = ids.length === 1 && ids[0] !== GM_ENTRY ? ids[0] : null;
    if (!l || !id) return [];
    const held = litOn(l.lights, id);
    return GIVEN.filter((kind) => kind !== held?.kind).map((kind) => {
      const light = { kind, tokenId: id, carrier: props.name };
      return held
        ? [`Put out the ${lower(held.kind)}, light the ${lower(kind)}`, true, () => l.change(`Swap ${lower(held.kind)} for ${lower(kind)}`, (s, now) => swapLight(s, now, newId, light))]
        : [`Give ${lower(kind)}`, true, () => l.change(`Give ${lower(kind)}`, (s, now) => addLight(s, now, newId, light))];
    });
  }

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

const newId = () => crypto.randomUUID();

export default RowMenu;
