import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OBR from "@owlbear-rodeo/sdk";

import App from "./App";
import { LIGHTS_KEY, SETTINGS_KEY, TRACKER_KEY } from "../constants";
import { MINUTE } from "../lights";
import { REPLY_CHANNEL, REQUEST_CHANNEL } from "../playerLights";
import { GM_ENTRY } from "../tracker";
import { obr, receiveBroadcast, setParty, token, writeFromElsewhere } from "../test/obrMock";

// The player (player-1) placed Aria; Borin is someone else's.
const setup = (settings: object, lights: object[] = []) => {
  obr.role = "PLAYER";
  obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin", createdUserId: "someone-else" })];
  obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }] } };
  obr.metadata = { [SETTINGS_KEY]: settings, [LIGHTS_KEY]: { lights } };
  obr.party = [{ id: "gm", connectionId: "gm-1", role: "GM", name: "GM" }] as never;
  render(<App />);
};
const torch = (tokenId: string) => ({ id: `l-${tokenId}`, kind: "torch", tokenId, status: "lit", remainingMs: 60 * MINUTE, endsAt: Date.now() + 60 * MINUTE });
const card = () => screen.findByRole("region", { name: "Your light" });
const sent = () => vi.mocked(OBR.broadcast.sendMessage).mock.calls.filter((c) => c[0] === REQUEST_CHANNEL).map((c) => c[1] as Record<string, unknown>);

describe("Your light (player)", () => {
  it("lights a torch on their own token by asking the GM's client", async () => {
    setup({ playersLight: true });
    fireEvent.click(await screen.findByRole("button", { name: "+ Torch" }));
    expect(sent()).toEqual([{ id: expect.any(String), tokenId: "a", action: "light", kind: "torch" }]);
    // Waiting for the GM: no second click.
    expect(screen.getByRole("button", { name: "+ Lantern" })).toBeDisabled();
    await receiveBroadcast(REPLY_CHANNEL, { id: sent()[0].id, error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Lantern" })).toBeEnabled());
  });

  it("with a torch lit: Put out, and another light asks before swapping", async () => {
    setup({ playersLight: true }, [torch("a")]);
    fireEvent.click(await screen.findByRole("button", { name: "Put out" }));
    expect(sent()[0]).toMatchObject({ tokenId: "a", action: "putOut" });
    await receiveBroadcast(REPLY_CHANNEL, { id: sent()[0].id, error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Lantern" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "+ Torch" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Lantern" }));
    expect(screen.getByRole("alertdialog", { name: "Put out the torch, light lantern?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Light lantern" }));
    expect(sent()[1]).toMatchObject({ tokenId: "a", action: "light", kind: "lantern" });
  });

  it("a refusal from the GM's client is told", async () => {
    setup({ playersLight: true });
    fireEvent.click(await screen.findByRole("button", { name: "+ Torch" }));
    await receiveBroadcast(REPLY_CHANNEL, { id: sent()[0].id, error: "Up to 16 lights" });
    await waitFor(() => expect(OBR.notification.show).toHaveBeenCalledWith("Up to 16 lights", "WARNING"));
  });

  it("no GM in the room: no buttons, and it says why", async () => {
    setup({ playersLight: true });
    await screen.findByRole("button", { name: "+ Torch" });
    await setParty([]);
    expect(screen.queryByRole("button", { name: "+ Torch" })).not.toBeInTheDocument();
    expect(screen.getByText(/The GM isn't in the room/)).toBeInTheDocument();
  });

  it("not allowed: a light the GM gave shows with no buttons; nothing given, no card", async () => {
    setup({}, [torch("a")]);
    expect(await card()).toHaveTextContent("The GM lights and puts out lights at this table.");
    expect(screen.queryByRole("button", { name: /Put out|\+/ })).not.toBeInTheDocument();
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [torch("b")] } });
    expect(screen.queryByRole("region", { name: "Your light" })).not.toBeInTheDocument();
  });

  it("the party's light and the badges, unless the GM hides the lights", async () => {
    setup({}, [torch("a"), torch("b")]);
    expect(await screen.findByText("Party has light · 2 shining")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Torch: / })).toHaveLength(2);
    await writeFromElsewhere({ [SETTINGS_KEY]: { showLights: false } });
    expect(screen.queryByText(/Party has light/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Torch: / })).not.toBeInTheDocument();
    // Their own still shows in their card.
    expect(await card()).toHaveTextContent("Torch");
  });
});
