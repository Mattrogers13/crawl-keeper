import { errorMessage, notify } from "../utils";

export const FIRST_RETRY_MS = 2000;
export const MAX_RETRY_MS = 30_000;

// Read a value from Owlbear once, then follow its change events: the one
// copy of this for every hook (useRoomValue, useRole, useScene). Call it in
// an effect and return what it returns (it unsubscribes and stops retrying).
//
// - A change event is newer than a read still in flight, so once an event
//   has come in, late read answers are ignored.
// - A failed read retries with back-off (2 s doubling to 30 s) while
//   mounted, logging each failure. With `notify`, the user is told once, on
//   failure number `after`: a panel stuck loading needs an explanation.
export const readAndFollow = <T>(opts: {
  read: () => Promise<T>;
  follow: (take: (value: T) => void) => () => void;
  take: (value: T) => void;
  // What's being read, for the log: "the player role".
  what: string;
  notify?: { after: number; message: string };
}) => {
  let alive = true;
  let fromEvent = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let wait = FIRST_RETRY_MS;
  let failures = 0;
  const read = () =>
    opts
      .read()
      .then((value) => {
        if (alive && !fromEvent) opts.take(value);
      })
      .catch((err) => {
        if (!alive || fromEvent) return;
        console.warn(`Couldn't read ${opts.what}, retrying: ${errorMessage(err)}`);
        if (++failures === opts.notify?.after) notify(`${opts.notify.message}: ${errorMessage(err)}`, "ERROR");
        retry = setTimeout(read, wait);
        wait = Math.min(wait * 2, MAX_RETRY_MS);
      });
  read();
  const off = opts.follow((value) => {
    fromEvent = true;
    opts.take(value);
  });
  return () => {
    alive = false;
    clearTimeout(retry);
    off();
  };
};
