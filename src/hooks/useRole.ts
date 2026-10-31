import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { readAndFollow } from "./readAndFollow";

export type Role = "GM" | "PLAYER";

// The player's role, or null until Owlbear reports it. Render nothing
// role-specific while it's null, so a player never briefly runs GM logic.
// A failed lookup retries; the third failure tells the user, since a blank
// panel needs an explanation.
export const useRole = (): Role | null => {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(
    () =>
      readAndFollow({
        read: () => OBR.player.getRole(),
        follow: (take) => OBR.player.onChange((player) => take(player.role)),
        take: setRole,
        what: "the player role",
        notify: { after: 3, message: "Can't reach Owlbear yet" },
      }),
    [],
  );

  return role;
};
