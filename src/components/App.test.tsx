import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import App from "./App";
import OBR from "@owlbear-rodeo/sdk";
import { act } from "@testing-library/react";

import { becomeReady, changePlayer, changeTheme, DARK_THEME, LIGHT_THEME, obr } from "../test/obrMock";

describe("App", () => {
  it("makes no SDK calls until Owlbear is ready (they would throw)", async () => {
    obr.ready = false;
    render(<App />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(OBR.player.getRole).not.toHaveBeenCalled();
    expect(OBR.room.getMetadata).not.toHaveBeenCalled();
    expect(OBR.theme.getTheme).not.toHaveBeenCalled();
    await becomeReady();
    expect(await screen.findByText("GM / Monsters")).toBeInTheDocument();
  });

  it("lets a theme change beat a slower theme lookup", async () => {
    let answer!: () => void;
    vi.spyOn(OBR.theme, "getTheme").mockImplementation(
      () => new Promise((resolve) => (answer = () => resolve(DARK_THEME))),
    );
    render(<App />);
    await changeTheme(LIGHT_THEME);
    await act(async () => answer());
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("switches views when the role changes", async () => {
    obr.role = "PLAYER";
    render(<App />);
    expect(await screen.findByText("GM / Monsters")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    await changePlayer({ role: "GM" });
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("follows Owlbear's theme", async () => {
    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await changeTheme(LIGHT_THEME);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.getPropertyValue("--obr-paper")).toBe("#ffffff");
  });
});
