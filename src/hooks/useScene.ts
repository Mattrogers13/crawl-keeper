import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { readAndFollow } from "./readAndFollow";

// Whether a scene (map) is open, plus a counter that changes every time one
// opens. Key scene-bound components on `opened` so switching maps remounts
// them and they read the new scene from scratch. null = not known yet.
export const useSceneReady = () => {
  const [state, setState] = useState<{ ready: boolean | null; opened: number }>({ ready: null, opened: 0 });

  useEffect(
    () =>
      readAndFollow({
        read: () => OBR.scene.isReady(),
        follow: (take) => OBR.scene.onReadyChange(take),
        take: (ready: boolean) =>
          setState((s) => (s.ready === ready ? s : { ready, opened: ready ? s.opened + 1 : s.opened })),
        what: "whether a scene is open",
      }),
    [],
  );

  return state;
};

// Every item in the open scene, live; null until the first read lands.
// Mount only while a scene is ready. Nothing can be saved until the tokens
// are known (see Tracker), so a failed read retries.
export const useSceneItems = () => {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(
    () =>
      readAndFollow({
        read: () => OBR.scene.items.getItems(),
        follow: (take) => OBR.scene.items.onChange(take),
        take: setItems,
        what: "the scene's tokens",
      }),
    [],
  );

  return items;
};
