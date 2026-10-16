import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import { useRole } from "./useRole";
import { changePlayer, obr } from "../test/obrMock";

describe("useRole", () => {
  it("is null until Owlbear answers, then the role", async () => {
    obr.role = "PLAYER";
    const { result } = renderHook(() => useRole());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe("PLAYER"));
  });

  it("follows role changes", async () => {
    const { result } = renderHook(() => useRole());
    await waitFor(() => expect(result.current).toBe("GM"));
    await changePlayer({ role: "PLAYER" });
    expect(result.current).toBe("PLAYER");
  });

  it("lets a change event beat a slower lookup", async () => {
    let answer!: (r: "GM") => void;
    vi.spyOn(OBR.player, "getRole").mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useRole());
    await changePlayer({ role: "PLAYER" });
    await act(async () => answer("GM"));
    expect(result.current).toBe("PLAYER");
  });

  it("retries failed lookups and explains on the third failure", async () => {
    vi.useFakeTimers();
    try {
      obr.failRoleLookups = 3;
      const { result } = renderHook(() => useRole());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000);
      });
      expect(result.current).toBe("GM");
      expect(OBR.notification.show).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
