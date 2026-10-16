import { useEffect, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { ID } from "../constants";
import { readLocal, writeLocal } from "../storage";
import { errorMessage } from "../utils";

// Drag the grip to make Owlbear's popover taller or shorter. The height is
// remembered per browser (each player sizes their own) and put back when the
// panel opens.
const HEIGHT_KEY = `${ID}/panelHeight`;
const MIN = 300;
const MAX = 1400;

const clamp = (h: number) => Math.round(Math.min(Math.max(h, MIN), MAX));
const setHeight = (h: number) =>
  OBR.action.setHeight(h).catch((err) => console.warn(`Couldn't resize the panel: ${errorMessage(err)}`));

const ResizeGrip = () => {
  const drag = useRef<{ startY: number; startH: number; h: number; frame: number } | null>(null);

  useEffect(() => {
    const saved = Number(readLocal(HEIGHT_KEY));
    if (saved >= MIN) void setHeight(clamp(saved));
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to resize the panel"
      title="Drag to resize"
      className="flex h-3 shrink-0 cursor-ns-resize touch-none items-center justify-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        // screenY: the popover moves under the pointer as it resizes.
        drag.current = { startY: e.screenY, startH: window.innerHeight, h: window.innerHeight, frame: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.h = clamp(d.startH + e.screenY - d.startY);
        // One resize per frame, not per pointer event.
        if (!d.frame) {
          d.frame = requestAnimationFrame(() => {
            d.frame = 0;
            void setHeight(d.h);
          });
        }
      }}
      onPointerUp={() => {
        if (drag.current) writeLocal(HEIGHT_KEY, String(drag.current.h));
        drag.current = null;
      }}
    >
      <span className="h-1 w-10 rounded-full bg-obr-text-disabled" aria-hidden />
    </div>
  );
};

export default ResizeGrip;
