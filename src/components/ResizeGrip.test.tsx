import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import ResizeGrip from "./ResizeGrip";
import { ID } from "../constants";

const KEY = `${ID}/panelHeight`;

describe("ResizeGrip", () => {
  it("puts back the remembered height when the panel opens", async () => {
    localStorage.setItem(KEY, "720");
    render(<ResizeGrip />);
    await waitFor(() => expect(OBR.action.setHeight).toHaveBeenCalledWith(720));
    localStorage.removeItem(KEY);
  });

  it("resizes as you drag, within limits, and remembers the height", async () => {
    localStorage.removeItem(KEY);
    render(<ResizeGrip />);
    const grip = screen.getByRole("separator");
    const frame = () => act(() => new Promise((r) => setTimeout(r, 30)));
    fireEvent.pointerDown(grip, { screenY: 500, pointerId: 1 });
    fireEvent.pointerMove(grip, { screenY: 700, pointerId: 1 });
    await frame();
    expect(OBR.action.setHeight).toHaveBeenLastCalledWith(window.innerHeight + 200);
    fireEvent.pointerMove(grip, { screenY: -5000, pointerId: 1 });
    await frame();
    expect(OBR.action.setHeight).toHaveBeenLastCalledWith(300);
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(localStorage.getItem(KEY)).toBe("300");
    vi.mocked(OBR.action.setHeight).mockClear();
    fireEvent.pointerMove(grip, { screenY: 900, pointerId: 1 });
    await frame();
    expect(OBR.action.setHeight).not.toHaveBeenCalled();
  });
});
