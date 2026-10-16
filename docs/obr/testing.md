# Testing

`npm test` (vitest + jsdom). Every test runs against the in-memory SDK in `src/test/obrMock.ts`, installed and reset by `src/test/setup.ts`. `obrMock.test.ts` pins the mock's own contract.

## Driving the mock

| Need | Use |
|---|---|
| Start state | set `obr.role`, `obr.metadata`, `obr.theme` before `render` |
| Another client writes | `await writeFromElsewhere({ key: value })` |
| Role / name change | `await changePlayer({ role: "PLAYER" })` |
| Theme change | `await changeTheme(LIGHT_THEME)` |
| Incoming broadcast | `await receiveBroadcast(channel, data)` |
| Failed writes (e.g. 16 kB cap) | `obr.failWrites = true` |
| Writes in flight (sync races) | `obr.deferWrites = true`, then `await flushWrite()` per write |
| Failed role lookups | `obr.failRoleLookups = n` |
| Owlbear not ready yet | `obr.ready = false`, then `await becomeReady()` |
| One-off behavior | `vi.spyOn(OBR.room, "getMetadata").mockImplementation(...)` |

Add SDK APIs to the mock as you use them. Every mock function must return a promise when the real one does.

## Traps (each cost real debugging time)

- **Never assign over a mock function** (`OBR.room.getMetadata = vi.fn(...)`): it leaks into every later test, which then hang or fail far from the cause. Use `vi.spyOn`.
- **`restoreAllMocks` doesn't undo `spyOn` over a `vi.fn`** (spyOn reuses that mock; there's nothing to restore). `resetObr` uses `resetAllMocks`, which puts each `vi.fn`'s own implementation back.
- **Never `act(() => fnReturningPromise())`**: the arrow returns the promise and act misbehaves; every later test can render empty. Use a block body: `act(async () => { await fn(); })`.
- A `setState` updater that returns the same state can still re-render the component. If "doesn't re-render" matters, don't call `setState` at all.
- Tests that pass alone but fail in the full run = state leaking between tests. Run the single test (`npx vitest run file -t "name"`) to confirm, then find the leak; don't add waits.
- Fake timers: wrap advances in `act(async () => { await vi.advanceTimersByTimeAsync(ms); })` and restore real timers in `finally`.

## Regression tests must fail on the old code

Prove it before trusting it:

```bash
cp src/file.ts /tmp/file.bak && git show <old-ref>:src/file.ts > src/file.ts
npx vitest run src/file.test.ts   # should FAIL
cp /tmp/file.bak src/file.ts      # restore
```

Never `git checkout -- file` for this: it wipes uncommitted edits.

## Unhappy paths to cover

Failed reads (retry), failed writes (revert + tell the user), malformed room data (parse), role/theme events racing the initial lookup, localStorage throwing (`storage.test.ts`).

## Real Owlbear testing

Automated tests can't prove sync or rendering. For anything multi-client: one room, GM in one browser, player in a private window. Write the steps and a results table in a `TESTING.md` for the change.
