import { useState } from "react";

import Loading from "./Loading";
import { NOTE_KEY } from "../constants";
import type { Role } from "../hooks/useRole";
import { useRoomValue } from "../hooks/useRoomValue";
import { NOTE_MAX, parseNote } from "../note";
import { VERSION } from "../version";

// Example panel: the GM writes a note, everyone in the room sees it live.
// Replace with the extension's real UI.
const Panel = ({ role }: { role: Role }) => {
  const note = useRoomValue(NOTE_KEY, parseNote);

  return (
    <div className="flex min-h-screen flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold">My OBR Extension</h1>
      {!note.loaded ? (
        <Loading />
      ) : role === "GM" ? (
        <NoteEditor current={note.value} save={note.write} />
      ) : (
        <p className="whitespace-pre-wrap">{note.value || <span className="text-obr-text-secondary">No note yet.</span>}</p>
      )}
      <Footer />
    </div>
  );
};

const NoteEditor = ({ current, save }: { current: string; save: (v: string) => Promise<boolean> }) => {
  const [draft, setDraft] = useState(current);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save(draft.slice(0, NOTE_MAX));
      }}
    >
      <label className="text-sm text-obr-text-secondary" htmlFor="note">
        Note for the table
      </label>
      <textarea
        id="note"
        className="rounded border border-obr-text-disabled bg-obr-bg p-2"
        maxLength={NOTE_MAX}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        className="self-start rounded bg-obr-primary px-3 py-1 font-medium text-obr-primary-contrast disabled:opacity-50"
        disabled={draft === current}
      >
        Share
      </button>
    </form>
  );
};

const Footer = () => (
  <footer className="mt-auto text-xs text-obr-text-secondary">
    v{VERSION}
    {import.meta.env.VITE_BUILD_LABEL && <div>{import.meta.env.VITE_BUILD_LABEL}</div>}
  </footer>
);

export default Panel;
