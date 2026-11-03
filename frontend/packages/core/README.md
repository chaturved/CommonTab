# @commontab/core

Pure TypeScript domain logic. No React, React Native or Node imports (a test enforces it); storage, network, clock and ids are injected.

| Folder | What it holds |
|---|---|
| `money/`, `splitter/`, `ledger/` | Cents math, equal/exact/percent/by-item splits, balances, simplify debts. Golden fixtures shared with the backend (`fixtures/money/`). |
| `types.ts` | Wire types from `docs/shared-api.md`, plus the injected `Clock` and `Random`. |
| `storage/` | `Storage` interface (record-oriented, atomic `transaction`) and `MemoryStorage`. SQLite (mobile) and IndexedDB (web) implement the same interface in the app. |
| `outbox/` | Queue entries, per-record coalescing, per-group order, backoff (2s, 4s ... 5 min, +/-20% jitter). |
| `api/` | `Api` interface, `HttpApi` over an injected `fetch`, `ApiError` (status 0 = no answer). |
| `auth/` | `TokenStore` interface and `AuthSession` (sign in/out). |
| `sync/` | `Actions` (what a person does: write locally + enqueue in one transaction) and `SyncEngine` (push, pull, conflicts, connectivity, status for the sync chip). |

## How the app uses it

```ts
const engine = new SyncEngine({ storage, api, clock, random });
const actions = new Actions({ storage, clock, random, notify: engine.notify });

await actions.saveExpense(groupId, draft);   // local first; never waits on the network
engine.sync();                                // on foreground, connectivity change, a timer, "Retry"
const status = await engine.status();         // { connectivity, waiting, failed, conflicts, chip, nextRetryAt }
```

The engine does not own timers or reachability listeners; the app calls `sync()` on those triggers and can use `status().nextRetryAt` to schedule the next one.

## Rules worth knowing

- A local change and its outbox entry are written in one transaction. Records carry `syncState`: `synced | pending | failed | conflict`.
- `401` pauses the queue (`connectivity: 'sessionExpired'`); `engine.resume()` after sign-in. Nothing is discarded.
- `422`, `404` and id clashes park the entry as `failed` and keep the person's data. Editing the record sends it again; `actions.discardFailed(opId)` drops it.
- `409 version_conflict`: the newer edit wins. If this device's edit is newer it is re-sent on top and the replaced version goes to the record's `history`. If the other edit is newer, or the record was deleted, the record shows the server's version in state `conflict` with the loser in `conflict.mine`; `actions.resolveConflict(id, 'mine' | 'theirs')` ("Keep mine" on a deleted record is Restore).
- Pull replaces `synced` records only, and keeps people added or renamed on this device whose push has not landed.
- Groups created with `localOnly: true` never leave the phone until `actions.uploadGroup(id)`.

Tests: `npm test` in this folder. The sync scenarios run against `test/fakeServer.ts`, an in-memory server that follows the API contract.
