// localStorage can throw in Owlbear's cross-origin iframe (Safari "Block all
// cookies", some Firefox privacy modes). Everything here is a per-browser
// convenience, so a failure just means "not remembered".

export const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; still works for this session.
  }
};

// sessionStorage, same rules: this tab only, gone on reload or close (the
// GM's undo history, src/undo.ts). Panel and background page share it (same
// origin, same tab). Returns false when the write didn't stick (blocked or
// full), so the caller can trim and retry.
export const readSession = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeSession = (key: string, value: string): boolean => {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
