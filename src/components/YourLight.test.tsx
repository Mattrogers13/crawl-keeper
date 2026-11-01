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
// The player's flame opens their Light Tracker, where the card is.
const setup = async (settings: object, lights: object[] = [], open = true) => {
  obr.role = "PLAYER";
  obr.items = [token("a", { name: "Aria" }), token("b", { name: "Borin", createdUserId: "someone-else" })];
  obr.sceneMetadata = { [TRACKER_KEY]: { entries: [{ id: "a" }, { id: "b" }, { id: GM_ENTRY }] } };
  obr.metadata = { [SETTINGS_KEY]: settings, [LIGHTS_KEY]: { lights } };
  obr.party = [{ id: "gm", connectionId: "gm-1", role: "GM", name: "GM" }] as never;
  render(<App />);
  if (open) fireEvent.click(await screen.findByRole("button", { name: "Light Tracker" }));
};
const torch = (tokenId: string) => ({ id: `l-${tokenId}`, kind: "torch", tokenId, status: "lit", remainingMs: 60 * MINUTE, endsAt: Date.now() + 60 * MINUTE });
const card = () => screen.findByRole("region", { name: "Your light" });
const sent = () => vi.mocked(OBR.broadcast.sendMessage).mock.calls.filter((c) => c[0] === REQUEST_CHANNEL).map((c) => c[1] as Record<string, unknown>);

describe("Your light (player)", () => {
  it("lights a torch on their own token by asking the GM's client", async () => {
    await setup({ playersLight: true });
    fireEvent.click(await screen.findByRole("button", { name: "+ Torch" }));
    expect(sent()).toEqual([{ id: expect.any(String), tokenId: "a", action: "light", kind: "torch" }]);
    // Waiting for the GM: no second click.
    expect(screen.getByRole("button", { name: "+ Lantern" })).toBeDisabled();
    await receiveBroadcast(REPLY_CHANNEL, { id: sent()[0].id, error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Lantern" })).toBeEnabled());
  });

  it("with a torch lit: Put out, and another light asks before swapping", async () => {
    await setup({ playersLight: true }, [torch("a")]);
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
    await setup({ playersLight: true });
    fireEvent.click(await screen.findByRole("button", { name: "+ Torch" }));
    await receiveBroadcast(REPLY_CHANNEL, { id: sent()[0].id, error: "Up to 16 lights" });
    await waitFor(() => expect(OBR.notification.show).toHaveBeenCalledWith("Up to 16 lights", "WARNING"));
  });

  it("a party-mate's token they lit shows in their card too", async () => {
    await setup({ playersLight: true }, [{ ...torch("b"), by: "player-1" }]);
    expect(await card()).toHaveTextContent("Borin");
    expect(screen.getByRole("region", { name: "Your light" })).toHaveTextContent("Aria");
  });

  it("no GM in the room: no buttons, and it says why", async () => {
    await setup({ playersLight: true });
    await screen.findByRole("button", { name: "+ Torch" });
    await setParty([]);
    expect(screen.queryByRole("button", { name: "+ Torch" })).not.toBeInTheDocument();
    expect(screen.getByText(/The GM isn't in the room/)).toBeInTheDocument();
  });

  it("not allowed: a light the GM gave shows with no buttons; nothing given, no card", async () => {
    await setup({}, [torch("a")]);
    expect(await card()).toHaveTextContent("The GM lights and puts out lights at this table.");
    expect(screen.queryByRole("button", { name: /Put out|\+/ })).not.toBeInTheDocument();
    await writeFromElsewhere({ [LIGHTS_KEY]: { lights: [torch("b")] } });
    expect(screen.queryByRole("region", { name: "Your light" })).not.toBeInTheDocument();
  });

  it("the badges on the tracker, unless the GM hides the lights; nothing added above the list", async () => {
    await setup({}, [torch("a"), torch("b")], false);
    expect((await screen.findAllByRole("img", { name: /Torch: / })).length).toBe(2);
    expect(screen.queryByRole("region", { name: "Your light" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Party has light/)).not.toBeInTheDocument();
    await writeFromElsewhere({ [SETTINGS_KEY]: { showLights: false } });
    expect(screen.queryByRole("img", { name: /Torch: / })).not.toBeInTheDocument();
  });

  it("their view: the party's light and every light, unless the GM hides them; their own stays", async () => {
    await setup({}, [torch("a"), torch("b")]);
    expect(await screen.findByText("Party has light · 2 shining")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The party's lights" })).toHaveTextContent("Borin");
    await writeFromElsewhere({ [SETTINGS_KEY]: { showLights: false } });
    expect(screen.queryByText(/Party has light/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "The party's lights" })).not.toBeInTheDocument();
    expect(await card()).toHaveTextContent("Torch");
  });
});
