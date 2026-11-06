// The session log view (Settings → Session log; players: the header's
// scroll): what this browser was told in this room, newest first, by day.
import { useEffect, useState } from "react";

import Confirm from "./Confirm";
import { clearLog, logText, onLogChange, readLog, type LogEntry, type LogKind } from "../sessionLog";

const ICON: Record<LogKind, string> = { light: "🔥", time: "⏳", effect: "⏱", combat: "⚔️", focus: "◎", session: "↺" };

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const download = (entries: LogEntry[]) => {
  const url = URL.createObjectURL(new Blob([logText(entries)], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `crawl-keeper-log-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SessionLog = () => {
  const [entries, setEntries] = useState(readLog);
  useEffect(() => onLogChange(() => setEntries(readLog())), []);
  if (entries.length === 0)
    return (
      <p className="rounded-[10px] bg-obr-bg px-3 py-2 text-sm text-obr-text-secondary">
        Nothing yet. Lights burning out, Time passes, effects ending, combat and focus lost are written here as they happen, in this browser.
      </p>
    );
  // Grouped by day, newest first.
  const days: { label: string; items: LogEntry[] }[] = [];
  for (const e of entries) {
    const label = day(e.at);
    if (days.at(-1)?.label !== label) days.push({ label, items: [] });
    days.at(-1)!.items.push(e);
  }
  return (
    <div className="flex flex-col gap-3 pb-2">
      <ol aria-label="Session log" className="flex flex-col gap-3">
        {days.map((d) => (
          <li key={d.label} className="flex flex-col gap-1">
            <h3 className="px-1 text-[11px] font-medium tracking-[0.06em] text-obr-text-secondary uppercase">{d.label}</h3>
            <ol className="flex flex-col divide-y divide-obr-text/10 rounded-xl bg-obr-bg text-xs ring-1 ring-obr-text/10 ring-inset">
              {d.items.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-baseline gap-2 px-2.5 py-1.5">
                  <span className="w-14 shrink-0 font-mono text-[11px] text-obr-text-secondary tabular-nums">{time(e.at)}</span>
                  <span className="w-4 shrink-0 text-center" aria-hidden>
                    {ICON[e.kind]}
                  </span>
                  <span className="min-w-0 flex-1">{e.text}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-obr-text-secondary">
          {entries.length} entries, this browser only
        </span>
        <span className="flex items-center gap-3">
          <button type="button" className="py-1.5 text-obr-text-secondary underline hover:text-obr-text" onClick={() => download(entries)}>
            Download
          </button>
          <Confirm label="Clear" question="Clear the whole log in this browser?" action="Clear" onConfirm={clearLog} />
        </span>
      </div>
    </div>
  );
};

export default SessionLog;
