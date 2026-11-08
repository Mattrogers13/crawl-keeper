import { useEffect, useState } from "react";

import { FlameIcon, ScrollIcon } from "./icons";
import LightTracker from "./LightTracker";
import PlayerLights from "./PlayerLights";
import Loading from "./Loading";
import ResizeGrip from "./ResizeGrip";
import SessionLog from "./SessionLog";
import Settings from "./Settings";
import Tracker from "./Tracker";
import UndoBar from "./UndoBar";
import { onAddEffect } from "../addEffectHandoff";
import { useLights } from "../hooks/useLights";
import { pause, resume } from "../lights";
import type { Role } from "../hooks/useRole";
import { useSceneItems, useSceneReady } from "../hooks/useScene";
import { VERSION } from "../version";

const Panel = ({ role }: { role: Role }) => {
  const scene = useSceneReady();
  // Settings is the GM's only; the Light Tracker is everyone's (players get
  // their own, PlayerLights). Each replaces the tracker, with a back arrow.
  const [view, setView] = useState<"tracker" | "settings" | "lights" | "log">("tracker");
  const shown = role === "GM" || view !== "settings" ? view : "tracker";
  // The map's right-click Add effect… shows the list, where the form opens.
  useEffect(() => (role === "GM" ? onAddEffect(() => setView("tracker")) : undefined), [role]);
  const away = shown !== "tracker";
  // The GM reaches the log from Settings: back goes there.
  const back = shown === "log" && role === "GM" ? "settings" : "tracker";
  // Beside the lights and settings: the tracker's own buttons (the GM's ⏳).
  const [toolSlot, setToolSlot] = useState<HTMLSpanElement | null>(null);
  // Beside the title: the tracker puts the round count here.
  const [titleSlot, setTitleSlot] = useState<HTMLSpanElement | null>(null);

  return (
    // Fills the popover: header and footer stay put, the content scrolls.
    <div className="flex h-screen flex-col gap-3 p-3 pb-0">
      {role === "GM" && <PausedBar />}
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-obr-text/10 pb-3">
        <div className="flex items-center gap-2">
          {away && (
            <button
              type="button"
              aria-label={back === "settings" ? "Back to Settings" : "Back to tracker"}
              title={back === "settings" ? "Back to Settings" : "Back to tracker"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
              onClick={() => setView(back)}
            >
              <BackIcon />
            </button>
          )}
          {!away && <KeyIcon />}
          {/* The tracker shows the key alone: Owlbear's toolbar button already
              names the extension, and the round count needs the room (UI
              review, 2026-11-08). */}
          <h1 className={away ? "shrink-0 text-[17px] font-medium tracking-[0.01em] whitespace-nowrap" : "sr-only"}>{TITLES[shown]}</h1>
          {!away && <span ref={setTitleSlot} className="min-w-0 truncate text-xs text-obr-text-secondary empty:hidden" />}
          {role !== "GM" && !away && (
            <div className="ml-auto flex">
              {/* Players have no Settings: the log has its own button. */}
              <button
                type="button"
                aria-label="Session log"
                title="Session log"
                className="flex h-8 w-8 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
                onClick={() => setView("log")}
              >
                <ScrollIcon className="h-5 w-5" />
              </button>
              <LightsButton open={() => setView("lights")} />
            </div>
          )}
          {role === "GM" && !away && (
            <div className="ml-auto flex shrink-0">
              <span ref={setToolSlot} className="flex empty:hidden" />
              <PauseButton />
              <LightsButton open={() => setView("lights")} />
              <button
                type="button"
                aria-label="Settings"
                title="Settings"
                className="flex h-8 w-8 items-center justify-center rounded-full text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
                onClick={() => setView("settings")}
              >
                <GearIcon />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {shown === "log" ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <SessionLog />
          </div>
        ) : shown === "lights" ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            {role !== "GM" ? (
              scene.ready ? (
                <PlayerLightsOnMap key={scene.opened} />
              ) : (
                <PlayerLights items={[]} />
              )
            ) : scene.ready ? (
              <LightsOnMap key={scene.opened} />
            ) : (
              <LightTracker names={NO_NAMES} />
            )}
          </div>
        ) : shown === "settings" ? (
          // relative: the switches' hidden inputs (sr-only, absolute) are
          // placed in here; otherwise against the page, which then scrolls
          // too (a second scrollbar, Matt's room pass 2026-10-31).
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <Settings openLog={() => setView("log")} />
          </div>
        ) : scene.ready === null ? (
          <Loading />
        ) : scene.ready ? (
          // A new key per opened scene: switching maps reads the new map fresh.
          <Tracker key={scene.opened} role={role} toolSlot={toolSlot} titleSlot={titleSlot} openLights={() => setView("lights")} />
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

// While the lights are paused, a slim amber bar across the top; clicking it
// resumes them. One control at a time: the header's ❚❚ while running, this
// bar while paused (UI review, Matt, 2026-11-08: amber for now, red maybe
// after trying it; red stays for danger).
const PausedBar = () => {
  const { loaded, lights, change } = useLights();
  if (!loaded || !lights.paused) return null;
  return (
    <button
      type="button"
      aria-label="Lights paused. Resume"
      title="Lights are paused. Click to resume"
      className="-mx-3 -mt-3 flex shrink-0 items-center gap-2 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-500/30 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-amber-400 dark:text-amber-300"
      onClick={() => change("Resume lights", resume)}
    >
      <span aria-hidden>❚❚</span>
      <span className="flex-1 text-left">Lights paused</span>
      <span className="font-semibold">Resume</span>
    </button>
  );
};

// Pause the light timers from the main page (Matt, 2026-11-07), the same
// change as the Light Tracker's button. Only once there are lights, and only
// while running: paused, the bar above resumes.
const PauseButton = () => {
  const { loaded, lights, change } = useLights();
  if (!loaded || lights.lights.length === 0 || lights.paused) return null;
  return (
    <button
      type="button"
      aria-label="Pause lights"
      title="Pause the lights"
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-obr-text-secondary hover:bg-obr-bg hover:text-obr-text"
      onClick={() => change("Pause lights", pause)}
    >
      ❚❚
    </button>
  );
};

// The way into the Light Tracker, always here; dim while no lights are
// tracked.
const LightsButton = ({ open }: { open: () => void }) => {
  const { loaded, lights } = useLights();
  const none = !loaded || lights.lights.length === 0;
  return (
    <button
      type="button"
      aria-label="Light Tracker"
      title={none ? "Light Tracker (no lights yet)" : "Light Tracker"}
      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-obr-bg"
      onClick={open}
    >
      <span className={none ? "opacity-40 grayscale" : ""}>
        <FlameIcon className="block h-5 w-4" />
      </span>
    </button>
  );
};

const TITLES = { tracker: "Crawl Keeper", settings: "Settings", lights: "Light Tracker", log: "Session log" };

// The Light Tracker with the open map's token names (lights cross maps; a
// token not on this one shows the name it was lit with).
const NO_NAMES = new Map<string, string>();
const LightsOnMap = () => {
  const items = useSceneItems();
  if (items === null) return <Loading />;
  const names = new Map(items.map((i) => [i.id, i.name?.trim() || "Unnamed"]));
  return <LightTracker names={names} />;
};

// The players' view needs the open map's tokens (which are theirs, names).
const PlayerLightsOnMap = () => {
  const items = useSceneItems();
  if (items === null) return <Loading />;
  return <PlayerLights items={items} />;
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
