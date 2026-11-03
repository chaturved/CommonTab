# Progress

Branch: `rebuild/cross-platform`. One commit per logical change, messages start with `step N:`; the last commit of each step is tagged `step-N-done`.

## Step 1: repo restructure — done
- `services/api` → `backend` (package `commontab_api` → `app`), `apps/ios` → `legacy/ios`, `apps/web` → `website`, design docs → `docs/design`, `CLAUDE.md` at root.
- `apps/react-native` placeholder removed; `frontend/` npm workspace skeleton added.
- CI, README, docs, `.gitignore` and `scripts/generate_icon.swift` paths updated. No behavior changes.
- Checks: backend 11 tests pass. SPEC acceptance criteria not yet applicable (no new behavior).

## Step 2: `frontend/packages/core` money, splitter, ledger — done
- `money`: currency digits, exact decimal parse/format, `allocateProportionally` (largest remainder, bigint inside).
- `splitter`: equal, exact, percent, by-item with tax and tip. Same rules as the Swift app and `backend/app/groups/rules.py`.
- `ledger`: `computeBalances` (skips tombstones), `simplifyDebts` (greedy, deterministic).
- Shared fixtures in `fixtures/money/`; Swift golden cases ported. Core runs all of them; the backend runs the equal, exact and percent files (`backend/tests/test_money_fixtures.py`). By-item, ledger and simplify exist only in core; the server has no such functions yet.
- Tests: core 116, backend 34 (11 existing, 23 fixtures). CI has a new `frontend` job.
- SPEC check: "$100.00 across 3 gives 33.34 / 33.33 / 33.33, sums to 10000" has a fixture and a unit test. Other criteria depend on later steps.

Notes for later:
- Simplify debts is greedy, not minimal. Exact search for small groups can replace it later; the fixtures and properties stay valid.
- Design bug: `Simplify.dc.html` shows "Sam pays You $5.00" after simplifying, but its four listed payments net to Riya owing $10 and Sam being owed $5. The numbers need fixing in the design copy.

## Step 3: `frontend/packages/ui` tokens and base components — done
- NativeWind **v4.2.7** (Tailwind 3.4) on Expo SDK 58 / React Native 0.88, as decided. A minimal Expo host in `frontend/apps/app` (config, `/gallery` route) proves the setup; real screens start in step 6.
- Tokens (`tokens.json` + `tokens.ts`), Tailwind preset with CSS variables for light and dark, WCAG AA contrast tests for every text/background pair in both schemes.
- Components: Text, Button, Card, Pill, Banner, SyncChip, AmountText, Avatar, AvatarStack, ListRow, Hero, Sheet, TabBar, Icon. `formatCurrency` added to core.
- Tests: core 126, ui 104 (labels, roles, 44pt minimums, min-height rows, money labeled), backend 34. CI runs frontend typecheck, tests and a web export.
- Verified: web build rendered in a browser at 390 wide in light and dark, including live switching of the system theme and the Sheet. iOS and Android bundles compile.
- SPEC check: dark mode contrast AA (token level, tested); money labeled not only colored (AmountText, tested); 44pt targets and min-height rows (tested); labels on controls (tested).

Not verified yet, so SPEC items stay open:
- **No native run.** Nothing has rendered on an iOS simulator or Android device; the iOS bundle compiles and NativeWind compiled the color variables with light/dark values, but that is not the same as seeing it. Large text (Dynamic Type / font scale) is untested: React Native Web does not scale with browser text size.
- **Manual appearance override** (Settings > appearance) is not built. It needs `Appearance.setColorScheme` on native and a separate approach on web. Planned for the Settings screen in step 6.
- Dark-mode values for warning, error, owe-tint and two extra avatar colors are derived, not from the designs. Please check them against the real dark screens.
- The screen designs use fixed `height: 72px` rows; components use `min-h` instead (per CLAUDE.md).

Decisions recorded: the Conflict screen follows SPEC and SYNC_ARCHITECTURE ("Keep mine" / "Keep theirs"), not the wording in `Conflict.dc.html`.

## Step 4: backend — done
- **Postgres + Alembic.** Supabase (Session pooler) is the hosting choice; the code only needs `DATABASE_URL` (`backend/.env`, gitignored). Migrations `0001` (schema) and `0002` (tombstones) are tested up and down. SQLAlchemy 2 + psycopg 3.
- **Layers.** `routes` / `service` / `repository` per area (accounts, groups, bill sessions); analytics has a repository only. Analytics, bill sessions and accounts moved off SQLite too.
- **Contract changes (all approved, documented in `docs/shared-api.md`):** 409 body `{detail, code, current}`; replaying an identical expense PUT returns 200; tombstones (`deletedExpenses`, `deletedAt`), delete wins and is repeatable, restore via the tombstone's version; settlements need no `groupVersion`, replay returns 200, same id + different payment is 409, overpayment is 422 with `maxAmountMinor`; `GET /healthz`.
- **Rate limiting** (added at your request): sign-in and sign-up per IP, other calls per session, 429 with `Retry-After`. In memory, so one API instance only.
- **Concurrency.** Settlements lock the group row; a test races two payments for the same balance and exactly one wins.
- **Tests.** Backend 75 (Postgres, each worker in its own throwaway schema, run 4 in parallel), core 126, ui 104. CI: new `backend` job with a Postgres 16 service, plus the frontend job.
- **Other fixes:** receipt bytes are no longer loaded for every expense in a snapshot; settlement check-then-insert race closed.

### SPEC acceptance checks for this step
- A settlement queued offline never fails with a version error; an overpayment is rejected with a clear message: tested.
- Deleting an expense updates balances for all members and appears in group history (`deletedExpenses`): tested.
- Reconnect after a lost response syncs once, no duplicates and no self-conflict: tested at the API (replay of create, edit, delete, restore, settlement). The client-side half comes with the sync engine (step 5).

### Not done / open
- **`alembic upgrade head` has not been run against your Supabase `public` schema.** Tests only use throwaway `test_*` schemas, so the database is still empty. Run it when you are ready (it creates nine tables), or tell me to.
- The Alembic **CLI** path is untested against a real database (tests call the same migrations through the Python API). The `uvicorn ... --factory` start was checked: `/healthz` answered `ok` against Supabase.
- The **Dockerfile** and the new **CI backend job** have not been run.
- Tests take about a minute because each statement is a ~65 ms round trip to Supabase from here; near the database it would be much faster.
- `SYNC_ARCHITECTURE.md` says expense retries are already safe. They were not: a retry of an applied write got a 409 for its own change. Fixed server-side, as above. The doc could be updated.
- Legacy iOS client: unchanged request shapes still work, except it no longer gets a 409 for deleting with a stale version.

### Backend gap list (v1 features SPEC needs that the API does not have yet; not built in step 4)
1. Invite by code only (today invitations are bound to an email and accepted only by that account).
2. ~~Members who are not accounts~~ done in step 4b.
3. Leave group (blocked while owed), delete group, archive when settled, removed-member read-only copy.
4. Delete account (removes server data).
5. `GET /groups/{id}/changes?since=` feed (SYNC phase 2), repeating expenses, push registration, exchange rates (v1.1).
6. Tombstone purge policy (kept forever for now).

## Step 4b: members who need no account — done
- **Data model (approved):** `members` (id, group, optional account, name) replaces `group_members`. Expenses, settlements and the allocations inside expenses now point at member ids. Migration `0003` converts existing data (one member per old group member, every reference remapped, order of allocations kept) and reverses it when every member has an account; `0004` lets an invitation name a person. Both are tested with seeded data, up and down.
- **Contract (approved, in `docs/shared-api.md`):** member objects `{id, name, userID, email}`; `meMemberID` and member-id `ownerID` in snapshots; `PUT /groups/{id}/members/{memberId}` to add or rename a person; `POST /groups` takes optional `id`, `members` and `meMemberID` and is repeatable; invitations take an optional `memberID` and accepting links that person to the account.
- **Breaking:** the old iOS client sends account ids as payer and participants, so it no longer works against this API (accepted: it is reference only).
- **Tests:** backend 104 (new: members, group create, linking by invitation, migrations with seeded data). Core and ui unchanged (core treats ids as opaque strings, so the shared fixtures did not change).
- **Not done:** leave group, remove a member, delete or archive a group, delete account, invite by code only. They remain in the gap list above; the model supports them without another reference migration (a `removed_at` column will come with them).
- **Open:** your Supabase `public` schema is at revision `0002`. `0003` and `0004` are not applied there yet; run `alembic upgrade head` from `backend/` when you want them (the tables are still empty, so it is safe).

## Step 5: core storage, outbox and sync engine — done
- **Contract change (approved):** expense records now carry `updatedAt` (UTC time of the last change on the server, also on tombstones and in the `409` `current`). "Newest edit wins" needs it; the server already stored it. One line in `docs/shared-api.md`, one backend test (105 backend tests).
- **Added to `packages/core`:** `types.ts`, `storage/` (interface + `MemoryStorage`), `outbox/` (coalescing, order, backoff), `api/` (`Api`, `HttpApi`, `ApiError`), `auth/` (`TokenStore`, `AuthSession`), `sync/` (`Actions`, `SyncEngine`, snapshot apply). See `frontend/packages/core/README.md`.
- **Tests:** core 194 (was 126): outbox/backoff units, HTTP error mapping, and the SYNC_ARCHITECTURE scenarios against a fake server: connection dropped after the server applied a write (create, edit, delete, payment, group create), second device editing the same expense (newer wins, Keep mine, Keep theirs, delete vs edit, Restore), token expiry mid-sync, a payment refused with `exceeds_balance`, 429/503 backoff, relaunch with a pending queue, local-only group upload resumed after a failure. ui 104 and app typecheck unchanged.
- **Deviations from SYNC_ARCHITECTURE.md (small, listed so you can veto):**
  - Outbox kinds are `group.create`, `member.put`, `expense.put`, `expense.delete`, `settlement.create`. `member.invite` and `group.patch` (rename) are online-only for now: an invite needs the server to make the code, and a rename is minor. Say if you want them queued.
  - Entries parked as `failed` or `conflict` do not block the rest of the group; a backing-off entry does (order is kept).
  - Outbox entries also carry `seq`, `editedAt`, `status` and `lastAttemptAt` (an edit-then-delete of a never-sent expense is cancelled without telling the server; once a send has started it sends the delete).

### SPEC acceptance checks for this step
- Airplane mode: add, edit, delete, kill and reopen; "waiting to sync"; reconnect sends once, no duplicates: tested in core against `MemoryStorage` (the "relaunch" is a new engine on the same storage). Real persistence comes with SQLite/IndexedDB in step 6.
- A settlement queued offline never fails with a version error; overpayment is rejected with a clear message: client side tested (failed state keeps what was typed and carries `maxAmountMinor`).
- Two devices edit the same expense: **partly**. If the earlier editor's push reaches the server after the later edit, they get the Conflict state with Keep mine / Keep theirs. If the earlier editor's push reaches the server first, the later edit wins automatically and the earlier editor only finds out on their next pull, as an `edited_elsewhere` entry in the record's history, not a Conflict screen. The server does not record that an edit overwrote another, so the client cannot tell this apart from an ordinary later edit. See open questions.
- Signing out with pending changes warns first: `engine.status().waiting` and `failed` are what the app checks; the warning itself is UI (step 6).

### Open / not verified
- **Open question for you:** is the history entry ("Dinner was edited elsewhere") enough for the earlier editor, or must they always get the Conflict screen? The second needs the server to keep a note when an edit replaces one the first editor already had acknowledged (a data model addition), so I did not do it without asking.
- The fake server is written by me from the contract; the client has not run against the real backend yet. Worth one smoke test against a local backend before step 6 relies on it.
- "Newest edit" compares the device clock with the server's `updatedAt`; a phone with a wrong clock can win or lose wrongly.
- Discarding a refused edit of an already-synced expense leaves the discarded text showing until the next pull.
- A group that disappears from the server (left, removed) is not handled yet; it needs the leave/remove work from the backend gap list.
- No real storage yet (SQLite, IndexedDB) and the triggers (foreground, connectivity, 5-minute timer) belong to the app; the engine exposes `nextRetryAt` for the timer.
- `SYNC_ARCHITECTURE.md` still says retries were already safe; the server fix is in step 4. Not edited.
