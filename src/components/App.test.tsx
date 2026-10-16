import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App";
import { NOTE_KEY } from "../constants";
import OBR from "@owlbear-rodeo/sdk";
import { act } from "@testing-library/react";

import { becomeReady, changePlayer, changeTheme, DARK_THEME, LIGHT_THEME, obr, writeFromElsewhere } from "../test/obrMock";

describe("App", () => {
  it("makes no SDK calls until Owlbear is ready (they would throw)", async () => {
    obr.ready = false;
    render(<App />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(OBR.player.getRole).not.toHaveBeenCalled();
    expect(OBR.room.getMetadata).not.toHaveBeenCalled();
    expect(OBR.theme.getTheme).not.toHaveBeenCalled();
    await becomeReady();
    expect(await screen.findByLabelText("Note for the table")).toBeInTheDocument();
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

  it("lets the GM share a note with the room", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Note for the table"), { target: { value: "Doors are locked" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(obr.metadata[NOTE_KEY]).toBe("Doors are locked"));
  });

  it("shows players the note, live, without the editor", async () => {
    obr.role = "PLAYER";
    obr.metadata = { [NOTE_KEY]: "Hello" };
    render(<App />);
    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(screen.queryByLabelText("Note for the table")).not.toBeInTheDocument();
    await writeFromElsewhere({ [NOTE_KEY]: "Updated" });
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("switches views when the role changes", async () => {
    obr.role = "PLAYER";
    render(<App />);
    expect(await screen.findByText("No note yet.")).toBeInTheDocument();
    await changePlayer({ role: "GM" });
    expect(screen.getByLabelText("Note for the table")).toBeInTheDocument();
  });

  it("follows Owlbear's theme", async () => {
    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await changeTheme(LIGHT_THEME);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.getPropertyValue("--obr-paper")).toBe("#ffffff");
  });
});
