import { useState } from "react";

import Loading from "./Loading";
import ResizeGrip from "./ResizeGrip";
import Settings from "./Settings";
import Tracker from "./Tracker";
import type { Role } from "../hooks/useRole";
import { useSceneReady } from "../hooks/useScene";
import { VERSION } from "../version";

const Panel = ({ role }: { role: Role }) => {
  const scene = useSceneReady();
  // Settings are the GM's only.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showSettings = settingsOpen && role === "GM";
  // Under the title, part of the top bar: the tracker puts the crawl
  // controls here (a portal), so they sit with the title.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  return (
    // Fills the popover: header and footer stay put, the content scrolls.
    <div className="flex h-screen flex-col gap-3 p-3 pb-0">
      <header className="flex shrink-0 flex-col gap-2 border-b border-obr-text-disabled pb-3">
        <div className="flex items-center gap-2">
          {showSettings && (
            <button
              type="button"
              aria-label="Back to tracker"
              title="Back to tracker"
              className="rounded px-1 text-lg leading-none hover:bg-obr-bg"
              onClick={() => setSettingsOpen(false)}
            >
              ←
            </button>
          )}
          <h1 className="text-lg font-semibold">{showSettings ? "Settings" : "Crawl Keeper"}</h1>
          {role === "GM" && !showSettings && (
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              className="ml-auto rounded p-1 text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
              onClick={() => setSettingsOpen(true)}
            >
              <GearIcon />
            </button>
          )}
        </div>
        {!showSettings && <div ref={setHeaderSlot} className="empty:hidden" />}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {showSettings ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Settings />
          </div>
        ) : scene.ready === null ? (
          <Loading />
        ) : scene.ready ? (
          // A new key per opened scene: switching maps reads the new map fresh.
          <Tracker key={scene.opened} role={role} headerSlot={headerSlot} />
        ) : (
          <p className="text-sm text-obr-text-secondary">Open a scene to use the tracker.</p>
        )}
      </main>
      <Footer />
      <ResizeGrip />
    </div>
  );
};

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
