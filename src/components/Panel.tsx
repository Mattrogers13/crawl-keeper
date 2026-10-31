import { useState } from "react";

import { FlameIcon } from "./icons";
import LightTracker from "./LightTracker";
import Loading from "./Loading";
import ResizeGrip from "./ResizeGrip";
import Settings from "./Settings";
import Tracker from "./Tracker";
import UndoBar from "./UndoBar";
import type { Role } from "../hooks/useRole";
import { useSceneItems, useSceneReady } from "../hooks/useScene";
import { VERSION } from "../version";

const Panel = ({ role }: { role: Role }) => {
  const scene = useSceneReady();
  // Settings and the Light Tracker are the GM's only; each replaces the
  // tracker, with a back arrow.
  const [view, setView] = useState<"tracker" | "settings" | "lights">("tracker");
  const shown = role === "GM" ? view : "tracker";
  const away = shown !== "tracker";
  // Under the title, part of the top bar: the tracker puts the crawl
  // controls here (a portal), so they sit with the title.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  // Beside the title: the tracker puts the round count here.
  const [titleSlot, setTitleSlot] = useState<HTMLSpanElement | null>(null);

  return (
    // Fills the popover: header and footer stay put, the content scrolls.
    <div className="flex h-screen flex-col gap-3 p-3 pb-0">
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-obr-text/10 pb-3">
        <div className="flex items-center gap-2">
          {away && (
            <button
              type="button"
              aria-label="Back to tracker"
              title="Back to tracker"
              className="flex h-9 w-9 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
              onClick={() => setView("tracker")}
            >
              <BackIcon />
            </button>
          )}
          {!away && <KeyIcon />}
          <h1 className="text-[17px] font-medium tracking-[0.01em]">{TITLES[shown]}</h1>
          {!away && <span ref={setTitleSlot} className="min-w-0 truncate text-xs text-obr-text-secondary empty:hidden" />}
          {role === "GM" && !away && (
            <div className="ml-auto flex">
              <button
                type="button"
                aria-label="Light Tracker"
                title="Light Tracker"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-obr-bg"
                onClick={() => setView("lights")}
              >
                <FlameIcon />
              </button>
              <button
                type="button"
                aria-label="Settings"
                title="Settings"
                className="flex h-9 w-9 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
                onClick={() => setView("settings")}
              >
                <GearIcon />
              </button>
            </div>
          )}
        </div>
        {!away && <div ref={setHeaderSlot} className="empty:hidden" />}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {shown === "lights" ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            {scene.ready ? <LightsOnMap key={scene.opened} /> : <LightTracker names={NO_NAMES} />}
          </div>
        ) : shown === "settings" ? (
          // relative: the switches' hidden inputs (sr-only, absolute) are
          // placed in here; otherwise against the page, which then scrolls
          // too (a second scrollbar, Matt's room pass 2026-10-31).
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <Settings />
          </div>
        ) : scene.ready === null ? (
          <Loading />
        ) : scene.ready ? (
          // A new key per opened scene: switching maps reads the new map fresh.
          <Tracker key={scene.opened} role={role} headerSlot={headerSlot} titleSlot={titleSlot} />
        ) : (
          <p className="text-sm text-obr-text-secondary">Open a scene to use the tracker.</p>
        )}
      </main>
      {role === "GM" && <UndoBar />}
      <Footer />
      <ResizeGrip />
    </div>
  );
};

const TITLES = { tracker: "Crawl Keeper", settings: "Settings", lights: "Light Tracker" };

// The Light Tracker with the open map's token names (lights cross maps; a
// token not on this one shows the name it was lit with).
const NO_NAMES = new Map<string, string>();
const LightsOnMap = () => {
  const items = useSceneItems();
  if (items === null) return <Loading />;
  return <LightTracker names={new Map(items.map((i) => [i.id, i.name?.trim() || "Unnamed"]))} />;
};

// The Keeper's key: a key with a torch-flame bow, beside the turn order. The
// same drawing as the toolbar icon (public/img/action.svg).
const KeyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-[22px] w-[22px] shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 3.5c1.8 1.7 3 3.3 3 5.2a3 3 0 0 1-6 0c0-1.2.6-2 1.3-2.7.3 1 .9 1.5 1.5 1.5C8 6.3 7.8 4.9 8 3.5z" />
    <path d="M8 12v9M8 16.5h3M8 19h2.5M14 8h7M14 12h7M14 16h5" />
  </svg>
);

// An arrow pointing left: back.
const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

// Drawn for this extension: eight teeth around a hole.
const GearIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M20.02 9.52 L22.84 10.14 L22.84 13.86 L20.02 14.48 L19.43 15.92 L20.98 18.35 L18.35 20.98 L15.92 19.43 L14.48 20.02 L13.86 22.84 L10.14 22.84 L9.52 20.02 L8.08 19.43 L5.65 20.98 L3.02 18.35 L4.57 15.92 L3.98 14.48 L1.16 13.86 L1.16 10.14 L3.98 9.52 L4.57 8.08 L3.02 5.65 L5.65 3.02 L8.08 4.57 L9.52 3.98 L10.14 1.16 L13.86 1.16 L14.48 3.98 L15.92 4.57 L18.35 3.02 L20.98 5.65 L19.43 8.08Z M15.6 12a3.6 3.6 0 1 0-7.2 0a3.6 3.6 0 1 0 7.2 0z"
    />
  </svg>
);

const Footer = () => (
  <footer className="shrink-0 text-xs text-obr-text-secondary">
    v{VERSION}
    {import.meta.env.VITE_BUILD_LABEL && <div>{import.meta.env.VITE_BUILD_LABEL}</div>}
  </footer>
);

export default Panel;
