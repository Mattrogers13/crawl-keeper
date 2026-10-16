import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";

import { errorMessage } from "../utils";

// Whether a scene (map) is open, plus a counter that changes every time one
// opens. Key scene-bound components on `opened` so switching maps remounts
// them and they read the new scene from scratch. null = not known yet.
export const useSceneReady = () => {
  const [state, setState] = useState<{ ready: boolean | null; opened: number }>({ ready: null, opened: 0 });

  useEffect(() => {
    let alive = true;
    // An onReadyChange event is newer than the isReady answer.
    let fromEvent = false;
    const take = (ready: boolean) =>
      setState((s) => (s.ready === ready ? s : { ready, opened: ready ? s.opened + 1 : s.opened }));
    OBR.scene
      .isReady()
      .then((ready) => alive && !fromEvent && take(ready))
      .catch((err) => console.warn(`Couldn't check for a scene: ${errorMessage(err)}`));
    const off = OBR.scene.onReadyChange((ready) => {
      fromEvent = true;
      take(ready);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return state;
};

// Every item in the open scene, live; null until the first read lands.
// Mount only while a scene is ready.
export const useSceneItems = () => {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    let fromEvent = false;
    // Nothing can be saved until the tokens are known (see Tracker), so a
    // failed read retries with back-off.
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait = 2000;
    const read = () =>
      OBR.scene.items
        .getItems()
        .then((all) => alive && !fromEvent && setItems(all))
        .catch((err) => {
          if (!alive || fromEvent) return;
          console.warn(`Couldn't read the scene's tokens, retrying: ${errorMessage(err)}`);
          retry = setTimeout(read, wait);
          wait = Math.min(wait * 2, 30_000);
        });
    read();
    const off = OBR.scene.items.onChange((all) => {
      fromEvent = true;
      setItems(all);
    });
    return () => {
      alive = false;
      clearTimeout(retry);
      off();
    };
  }, []);

  return items;
};
