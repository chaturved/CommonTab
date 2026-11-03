# Sync architecture (offline-first, cross-platform)

Target: iOS, Android and web from one TypeScript codebase. The rules below are platform-neutral; the stack and layout are in the last section.

Builds on the existing API in `docs/shared-api.md`. That API already has client-generated UUIDs (`PUT /expenses/{id}` is idempotent), expense versions, and a group version. Most of the work is on the app side.

## Principles
1. The local store is the source the UI reads. The network never blocks a screen.
2. Every user action writes locally and adds an outbox entry in one transaction.
3. Sync is a background loop: push the outbox, then pull changes. Safe to repeat at any time.
4. Money is integer minor units. Balances are always recomputed from expenses and settlements, never stored as edited numbers.

## Local store
SQLite on mobile (`expo-sqlite`), IndexedDB on web, behind one `Storage` interface in the core package. The old SwiftUI app's `expenses.json` is not reused. Per record add:
- `id` (UUID), `version` (last server version, null if never synced)
- `syncState`: `synced | pending | failed | conflict`
- `deletedAt` (tombstone; hidden in UI, kept until the delete is acknowledged)

### Outbox entry
`{ opId (UUID), kind: expense.put | expense.delete | settlement.create | group.patch | member.invite, groupId, entityId, payload, baseVersion, createdAt, attempts, lastError, nextAttemptAt }`
Entries for the same entity are coalesced (edit-then-edit sends one PUT). Order per group is preserved; different groups sync in parallel.

## Push
- Send entries in order. A `2xx` removes the entry and stores the returned version.
- Network failure or `5xx`: keep, backoff 2s, 4s, 8s ... capped at 5 min, with jitter. Retry on app foreground, connectivity change, and a 5-minute timer.
- `401`: pause the queue, show SessionExpired. Never discard entries; resume after sign-in.
- `422`: the change is invalid. Mark `failed`, keep the user's data, show SyncFailed with "Fix" and "Discard".
- `409` (stale version): see Conflicts.
- Because writes are keyed by UUID, a retry after a lost response cannot duplicate.

## Pull
Today `GET /groups/{id}` returns the full snapshot. Phase 1: pull snapshots after a successful push, on foreground, and on push notification. Phase 2 (server work): `GET /groups/{id}/changes?since=<groupVersion>` returning changed and deleted records, so large groups don't re-download everything.
Applying a snapshot: replace `synced` records; never overwrite records that are `pending` or `conflict`.

## Conflicts
- The server rejects a write whose `baseVersion` is older than the current version (`409` with the current record).
- Rule: **newest edit wins**, the other party is told. The app keeps the loser as a history entry and shows Conflict with "Keep mine" / "Keep theirs". Choosing "Keep mine" re-sends on top of the server version.
- Delete vs edit: the delete wins unless the editor chooses "Restore".
- Settlements are append-only and never edited, so they cannot conflict, but the server rejects a payment that would overpay a balance (see shared-api rules); the app shows SyncFailed.

## Server changes needed
Checked against the current backend (`services/api`, moving to `backend/`) (FastAPI + SQLite):
- Expense PUT already uses UUID + version and returns `409` on a stale version, so retries are safe.
- **Blocker for offline:** `POST /settlements` requires `groupVersion` to equal the current group version, and the version bumps on every change. A payment queued offline will almost always `409`. Change it to validate against balances at apply time instead (the existing overpay rules), and make a repeated settlement `id` with the same payload return `200`, not `409`.
- Expense delete is a hard `DELETE`, so other devices cannot learn about it. Add a tombstone (`deleted_at`) and return it in snapshots.
- `409` bodies are message strings only. Return the current record.
- SQLite is fine for one server with a persistent volume and backups. Plan a move to Postgres before multi-instance hosting.
1. `409` body includes the current record.
2. Deleted expenses returned as tombstones so other devices learn about deletes.
3. `changes` feed (phase 2).
4. Repeating expenses: server-side scheduler creating expenses with deterministic IDs (`hash(ruleId, date)`), so a retry never creates two.
5. Push notification registration endpoint and event fan-out.
6. Exchange-rate source for foreign currency; the rate used is stored on the expense.
7. A fixed production base URL, health endpoint (`/healthz`) used to tell "server down" from "no connection".

## Connectivity states (drive the UI)
- `online`, `offline` (no network: HomeOffline, banners), `serverDown` (network up, health check fails: ServerDown), `sessionExpired`.
- The sync chip shows Synced / "N waiting" / "Couldn't sync" from the outbox, not from reachability.

## First sign-in with existing local data (migration)
Existing installs have local-only groups with no account.
1. On first launch after the update, show Welcome. Existing local data is kept untouched on the device.
2. After create account or sign-in, show "Upload your existing groups?" listing them.
3. Uploading creates each group on the server (new group IDs, client-supplied expense UUIDs preserved), then marks them synced. Members who are not accounts stay as named members until invited.
4. If the user skips, the groups stay local-only and are labeled "On this phone only" with an "Upload" button. They never sync silently.
5. Signing in on a second device pulls the account's groups; local-only data on that device goes through the same prompt.
6. The upload is resumable: it is just outbox entries, so a failure part-way continues next launch.

## The "me" flag
Each group has a `meMemberId`, set when the group is created or joined (the member linked to the signed-in account). Without an account it is set by "Which one are you?" when a local group is first created. Balances, "you owe / owed", payer defaults, and leave rules read this flag.

## Security
Tokens in the OS secure store (`expo-secure-store`: Keychain / Keystore); on web, an httpOnly cookie or in-memory token, never localStorage. Never log tokens. Outbox payloads rely on OS file protection on mobile. Sign-out with pending entries asks first. Delete account removes server data and local data.

## Test plan
- Unit: outbox coalescing, backoff schedule, conflict resolution, idempotent retry (same op sent twice yields one expense).
- Integration with a fake server: drop connection after the server applied a write; second device edits the same expense; token expiry mid-sync.
- UI: airplane-mode add/edit/delete, relaunch with a pending queue, migration prompt.

## Suggested build order
1. Local store fields + `meMemberId`. 2. Outbox + push with retry. 3. Sync chip and offline banners. 4. Pull + conflicts. 5. Migration prompt. 6. Server: tombstones, 409 body, healthz. 7. Changes feed, repeating, push notifications.

## Stack and repo layout
- **Language:** TypeScript everywhere. **Mobile:** Expo (React Native). **Web:** Expo web first; split to Next.js only if SEO or web-only features need it.
- **Backend:** existing FastAPI service (moves to `backend/`); add the server changes listed above. Also: service layer (routes / service / repository), Postgres with Alembic from the start, shared JSON test fixtures for money rules, OpenAPI-generated TS client.
- **State/data:** the `Storage` interface plus a small observable store (Zustand or similar) so screens re-render when the outbox or records change. No UI reads the network directly.

```
commontab/
  frontend/                        # one npm workspace, TypeScript
    packages/
      core/                        # pure TypeScript, no UI or platform imports
        src/
          money/                   # cents math, currency, rounding
          splitter/                # equal, exact, percent, by-item
          ledger/                  # balances, simplify debts
          storage/                 # Storage interface and records
          outbox/                  # queue, coalescing, backoff
          sync/                    # push, pull, conflicts, migration
          api/                     # typed client generated from the backend OpenAPI schema
          auth/                    # session, token store interface
          types.ts
      ui/
        src/
          tokens.ts                # colors, radii, type (light and dark)
          components/              # Card, Pill, Banner, SyncChip, TabBar, AmountText
    apps/
      app/                         # Expo: iOS, Android and web from one codebase
        app/                       # expo-router
          (auth)/                  # welcome, sign-in, create-account, join
          (tabs)/                  # home, groups, activity, account
          group/[id]/              # detail, members, invite, settle, recurring
          expense/                 # add, [id], edit, choose-group, scan
          settings/
  backend/                         # FastAPI
    pyproject.toml
    Dockerfile
    app/
      main.py                      # router wiring, /healthz
      core/                        # config, logging, errors, rate limit, db session
      accounts/                    # routes, service, repository, models
      groups/                      # routes, service, repository, models, rules
      bill_sessions/
      analytics/
      worker/                      # later: repeating expenses and push jobs
    migrations/                    # Alembic, Postgres
    tests/
  legacy/
    ios/                           # current SwiftUI app, kept as reference
  website/                         # marketing site (today's static apps/web), deployed separately
  docs/design/                     # screens/, DESIGN.md, FLOWS.md, SYNC_ARCHITECTURE.md
```

Web is the same Expo app (react-native-web), not a separate project; use `.web.ts` files for the few platform differences (camera scan, storage). The marketing site lives in `website/` (static now; Next.js later if needed), designed in `screens/Landing.dc.html` and `LandingMobile.dc.html`.

Migration from today's repo: `services/api` to `backend/` (package `commontab_api` renamed `app`), `apps/ios` to `legacy/ios/`, `apps/react-native` replaced by `frontend/apps/app/`, and the current static `apps/web` to `legacy/web/`. Update CI workflow paths, README links, and the Xcode project path in the same change.

### Core rules
- `core` has no platform imports; storage, clock, network, and random IDs are injected so it runs in Jest and on every platform.
- Port `ExpenseSplitter` and `GroupLedger` from Swift first, with the existing Swift test cases ported as golden tests. Same inputs must give the same cents.
- Use `bigint` or integer math for money; never floats.

### Platform differences
| Area | Mobile | Web |
|---|---|---|
| Local store | SQLite | IndexedDB |
| Background sync | on foreground, connectivity change, timer; OS background fetch best-effort | only while the tab is open; sync on focus and `online` event |
| Push | Expo notifications (APNs/FCM) | Web push, optional |
| Receipt scan | camera + on-device OCR (native module) | upload photo, no live camera frame |
| Secure storage | Keychain / Keystore | cookie or memory |

### Updated build order
1. `core`: money, splitter, ledger with golden tests. 2. `core`: storage interface, outbox, sync engine against a fake server. 3. `ui`: tokens and the 5-tab shell. 4. Home, Groups, Group detail, Add/Edit/Delete expense. 5. Auth and migration prompt. 6. Sync chip, offline banners, conflicts. 7. Web target. 8. Scan, repeating, notifications, dark mode.
