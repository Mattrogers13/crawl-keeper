import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { errorMessage, notify } from "../utils";

export type Role = "GM" | "PLAYER";

const FIRST_RETRY_MS = 2000;
const MAX_RETRY_MS = 30_000;

// The player's role, or null until Owlbear reports it. Render nothing
// role-specific while it's null, so a player never briefly runs GM logic.
//
// - A role from player.onChange is newer than any getRole answer still in
//   flight, so once onChange has spoken, late getRole answers are ignored.
// - A failed lookup retries with back-off while mounted; the third failure
//   tells the user, since a blank panel needs an explanation.
export const useRole = (): Role | null => {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let alive = true;
    let fromEvent = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait = FIRST_RETRY_MS;
    let failures = 0;

    const load = () =>
      OBR.player
        .getRole()
        .then((r) => alive && !fromEvent && setRole(r))
        .catch((err) => {
          if (!alive || fromEvent) return;
          console.warn(`Couldn't get the player role, retrying: ${errorMessage(err)}`);
          if (++failures === 3) notify(`Can't reach Owlbear yet: ${errorMessage(err)}`, "ERROR");
          retry = setTimeout(load, wait);
          wait = Math.min(wait * 2, MAX_RETRY_MS);
        });

    load();
    const off = OBR.player.onChange((player) => {
      fromEvent = true;
      setRole(player.role);
    });
    return () => {
      alive = false;
      clearTimeout(retry);
      off();
    };
  }, []);

  return role;
};
