// The GM's undo history (docs/design.md, Torchlight merge: global undo).
// Pure: no SDK, no storage; src/undo.ts applies it.
//
// A step is one GM action: the metadata values it changed, before and after.
// Undo writes the befores back, Redo the afters. Things that happen by
// themselves (a token deleted from the map, darkness following Torchlight)
// aren't steps; undoing the step before them rolls them back too.

import { isObject } from "./parse";

export type Store = "room" | "scene";
export type Change = { store: Store; key: string; before: unknown; after: unknown };
export type Step = {
  id: string;
  // What the GM did, as the button says it: "Undo: Next turn".
  label: string;
  // The map a scene change belongs to (SCENE_ID_KEY); null if it only touched
  // the room. Scene metadata is the open map's only, so a step from another
  // map can't be applied.
  scene: string | null;
  changes: Change[];
  // A bigger action: the panel offers Undo in a toast for a few seconds.
  toast: boolean;
};
export type History = { undo: Step[]; redo: Step[] };

export const MAX_STEPS = 50;
export const EMPTY: History = { undo: [], redo: [] };

// A new action: on top of the undo stack (the oldest past MAX_STEPS drop),
// and Redo is gone.
export const pushStep = (h: History, step: Step): History => ({ undo: [...h.undo, step].slice(-MAX_STEPS), redo: [] });

// Undo moves the step it applied to Redo; Redo moves it back. `keep: false`
// drops it instead (it couldn't be applied: another map). By id, since the
// background page may have recorded a newer step meanwhile.
export const afterUndo = (h: History, step: Step, keep: boolean): History => {
  if (!h.undo.some((s) => s.id === step.id)) return h;
  return { undo: h.undo.filter((s) => s.id !== step.id), redo: keep ? [...h.redo, step] : h.redo };
};
export const afterRedo = (h: History, step: Step, keep: boolean): History => {
  if (!h.redo.some((s) => s.id === step.id)) return h;
  return { undo: keep ? [...h.undo, step] : h.undo, redo: h.redo.filter((s) => s.id !== step.id) };
};

// Keep the newest `n` undo steps (storage full) and all of Redo.
export const trim = (h: History, n: number): History => ({ undo: h.undo.slice(-n), redo: h.redo });

const parseChange = (raw: unknown): Change | null =>
  isObject(raw) && (raw.store === "room" || raw.store === "scene") && typeof raw.key === "string"
    ? { store: raw.store, key: raw.key, before: raw.before, after: raw.after }
    : null;

const parseStep = (raw: unknown): Step | null => {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.label !== "string" || !Array.isArray(raw.changes)) return null;
  const changes = raw.changes.map(parseChange);
  if (changes.length === 0 || changes.some((c) => c === null)) return null;
  return {
    id: raw.id,
    label: raw.label.slice(0, 60),
    scene: typeof raw.scene === "string" ? raw.scene : null,
    changes: changes as Change[],
    toast: raw.toast === true,
  };
};

const parseSteps = (raw: unknown): Step[] =>
  Array.isArray(raw) ? raw.map(parseStep).filter((s): s is Step => s !== null).slice(-MAX_STEPS) : [];

// From sessionStorage: anything malformed is dropped, never thrown. The
// values themselves go through each key's own parser when they're read back
// from Owlbear after an undo.
export const parseHistory = (json: string | null): History => {
  if (!json) return EMPTY;
  try {
    const raw: unknown = JSON.parse(json);
    return isObject(raw) ? { undo: parseSteps(raw.undo), redo: parseSteps(raw.redo) } : EMPTY;
  } catch {
    return EMPTY;
  }
};
