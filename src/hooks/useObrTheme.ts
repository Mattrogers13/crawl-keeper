import { useEffect } from "react";
import OBR, { type Theme } from "@owlbear-rodeo/sdk";

import { errorMessage } from "../utils";

// Owlbear's theme as CSS variables on <html> (used by index.css), plus the
// `dark` class for Tailwind's dark: variant. Matching Owlbear's own colors
// makes the panel look native in both light and dark mode.
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme.mode === "DARK");
  const vars: Record<string, string> = {
    "--obr-bg": theme.background.default,
    "--obr-paper": theme.background.paper,
    "--obr-text": theme.text.primary,
    "--obr-text-secondary": theme.text.secondary,
    "--obr-text-disabled": theme.text.disabled,
    "--obr-primary": theme.primary.main,
    "--obr-primary-contrast": theme.primary.contrastText,
    "--obr-secondary": theme.secondary.main,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
};

export const useObrTheme = () => {
  useEffect(() => {
    let alive = true;
    // A theme from theme.onChange is newer than the getTheme answer.
    let fromEvent = false;
    OBR.theme
      .getTheme()
      .then((theme) => alive && !fromEvent && applyTheme(theme))
      .catch((err) => console.warn(`Couldn't get the Owlbear theme: ${errorMessage(err)}`));
    const off = OBR.theme.onChange((theme) => {
      fromEvent = true;
      applyTheme(theme);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
};
