# Progress

Branch: `rebuild/cross-platform`. One commit per logical change, messages start with `step N:`; the last commit of each step is tagged `step-N-done`.

## Step 1: repo restructure — done
- `services/api` → `backend` (package `commontab_api` → `app`), `apps/ios` → `legacy/ios`, `apps/web` → `website`, design docs → `docs/design`, `CLAUDE.md` at root.
- `apps/react-native` placeholder removed; `frontend/` npm workspace skeleton added.
- CI, README, docs, `.gitignore` and `scripts/generate_icon.swift` paths updated. No behavior changes.
- Checks: backend 11 tests pass. SPEC acceptance criteria not yet applicable (no new behavior).

## Step 2: `frontend/packages/core` money, splitter, ledger — done
- `money`: currency digits, exact decimal parse/format, `allocateProportionally` (largest remainder, bigint inside).
- `splitter`: equal, exact, percent, by-item with tax and tip. Same rules as the Swift app and `backend/app/domain/rules.py`.
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
- **Decided (option 1):** if the earlier editor's push is accepted first and a later edit replaces it, they get a notice ("edited by someone else") and the old version in the record's history, not the Conflict screen. They get the Conflict screen only when their own push is the one refused. This is a small departure from the SPEC wording; revisit if testers want a one-tap way to put their version back (that would need a server note when an edit replaces another).
- The fake server is written by me from the contract; the client has not run against the real backend yet. Worth one smoke test against a local backend before step 6 relies on it.
- "Newest edit" compares the device clock with the server's `updatedAt`; a phone with a wrong clock can win or lose wrongly.
- Discarding a refused edit of an already-synced expense leaves the discarded text showing until the next pull.
- A group that disappears from the server (left, removed) is not handled yet; it needs the leave/remove work from the backend gap list.
- No real storage yet (SQLite, IndexedDB) and the triggers (foreground, connectivity, 5-minute timer) belong to the app; the engine exposes `nextRetryAt` for the timer.
- `SYNC_ARCHITECTURE.md` still says retries were already safe; the server fix is in step 4. Not edited.

## Step 5d: cookie and bearer sign-in — done
- Sign-up and sign-in also set an httpOnly session cookie (`commontab_session`, Secure, SameSite=Lax, 30 days); the token is still in the body and `Authorization: Bearer` still works (header wins). A cookie-authenticated write needs `X-CommonTab-Client` (CSRF). CORS allows `ALLOWED_ORIGINS` with credentials. Bill-session secrets are unchanged (bearer only). No database change.
- Rate limits key on the header or the cookie. `Settings` no longer prints `database_url`.
- Web and API must share a site in production (for example `app.` and `api.` on one domain).

## Step 5e: invite by code — done
- Migration 0005 makes `invitations.email` optional (a row with no email is a code). `POST /groups/{id}/invite-code` (any member; optional `memberID`) returns an 8-character code (`ABCD-2345`, 7 days); `POST /invitations/join {code}` adds the account and returns the group. Group codes are reusable until they expire; person codes link once. Codes are stored hashed, typed forgivingly (case, dash, I/L/O), and joining is rate limited per IP like sign-in. Email invitations are unchanged; the two kinds cannot be used on each other's route.
- Supabase `public` schema is migrated to 0005.

## Step 5f: forgot password — done
- Migration 0006 adds `password_resets` (code hash, user, expiry, used time, wrong-guess count). `POST /auth/password-reset {email}` always answers 202 and emails a code through Resend after the response (`app/integrations/mailer.py`; with no `RESEND_API_KEY` the code is logged instead, for development only); `POST /auth/password-reset/confirm {email, code, newPassword}` sets the password, signs out every session, and uses the code up. One email a minute per account, one hour of validity, five wrong guesses burn the code, per-IP limit like sign-in. A wrong code returns a 400 response instead of raising so the count of guesses is committed.
- `httpx` is now a runtime dependency. Needed from you before real emails: `RESEND_API_KEY` and `MAIL_FROM` on a domain verified in Resend (the default sender only reaches your own Resend account email).
- Test engines use small connection pools so four parallel workers stay under Supabase's 15-client session limit.

## Step 6a: app foundation — done
- **Core:** `PersistentStorage` (any `StorageDriver`: load rows, commit a batch atomically) wraps the in-memory store; a failed commit changes neither disk nor what the app reads. `HttpApi` has a cookie mode (sends credentials, plus `X-CommonTab-Client` on writes) and calls for `me`, password reset (request, confirm), invite code and join by code. `AuthSession.restore` checks the saved session at launch: a 401 signs out, no network keeps the cached user.
- **App:** SQLite driver (iOS/Android) and IndexedDB driver (web) in `apps/app/src/platform`; access token in the secure store on native, and on web the httpOnly cookie (no token kept across reloads). `AppProvider` builds the services, restores the session, and syncs at launch, on app foreground and when the browser comes back online. Expo Router guards: signed-out users see `(auth)`, signed-in users see `(app)`. Sign-out clears local data.
- **Placeholder screens:** `(auth)/index` and `(app)/index` are plain stand-ins to prove the plumbing; 6b and 6c replace them.
- **Smoke test against the real backend:** `SMOKE_API_URL=http://localhost:8000 npx jest smoke` (in `packages/core`, skipped otherwise). Two flows pass: offline create group and expense, sync, read back on a second device; edit then delete. The sync client and the real API agree on the contract; no mismatches found. It creates `smoke-*@example.com` users in whatever database the API points at.
- **Checked in a browser (web, API on Supabase):** sign up, reload (still signed in through the cookie, group still there from IndexedDB, chip "Synced"), sign out (IndexedDB emptied), sign in (group pulled back). iOS and Android bundles build; not run on a device or simulator.
- **Web fix:** NativeWind's dev server throws "Cannot manually set color scheme" when its stylesheet arrives after the page script; `apps/app/public/index.html` sets the dark-mode flag up front.
- Not done yet: sign-out warning about waiting changes (6e), network-status events beyond sync failures.
- Run locally: `uvicorn app.main:app` in `backend`, then `EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web` in `frontend/apps/app`.

## Step 6b: auth screens — done
- **Screens** (`apps/app/app/(auth)`): Welcome, Create account (name, email, password with the 15-character meter), Sign in (with the "WELCOME BACK" card, offline banner and "Try again", forgot-password link), and the **Session expired** sheet over the signed-in app (opens when the sync engine gets a 401; changes stay safe and sync after sign-in; "Not now" dismisses).
- **Forgot password, two new screens designed from DESIGN.md** (no design files existed): *Reset your password* (email, "Send code") and *Enter your code* (code, new password with the meter, "Send a new code", wrong-code error). Success returns to Sign in with an info banner and the email filled in. Wording never says whether the email has an account. **Please review these two against what you want.**
- **Core:** `passwordProgress`, `looksLikeEmail`, `describeAuthFailure` (offline, wrong password, email taken, wrong code, rate limited with seconds to wait, server down) with tests. **UI:** `FieldRow`/`FieldGroup`, `BackButton`, `PasswordMeter` with tests.
- **Checked in a browser at 390px** (API on Supabase, mail logged instead of sent): Welcome, Create account, Sign in wrong password, offline, the full reset (wrong code, then the logged code typed with a space and lower case, then sign in with the new password), session expired then sign in again (the waiting change synced), dark mode. iOS and Android bundles build; not run on a device.
- Not done: the "Have an invite code? Join a group" link on Welcome (comes with the Join screen in 6e); Terms and Privacy are plain text until the website (step 7) has pages. Disabled buttons use the kit's faded teal, not the design's grey (#C9D3D5).
- **Known gap:** signing out while offline on web cannot clear the cookie on the server, so the browser can still be signed in next time. The sign-out flow in 6e should say so.
- The Resend sandbox returned 422 for a message to `example.com`; the API logged it and still answered 202, as designed.

## Step 6c: home, groups, group detail — done
- **Screens:** tab shell (Home, Groups, +, Activity, Account), Home (overall balance hero with You owe / Owed to you, groups, recent expenses; the empty "Split costs without the awkward math" state), Groups (Active and Settled tabs, "Needs settling" cards with who owes whom), Create group (name, currency picker, people; the first person is you), Group detail (balance hero, balances, expenses, "All settled up" with payments, empty group), Members (owner, owes/owed). Offline: warning banner, "As of 11:13 AM · may not include changes from others", "1 change waiting to sync" on groups and expenses. Account has Sign out; Activity is an empty placeholder (the changes feed is still an open gap).
- **Core view models with tests** (`packages/core/src/views`): group summaries, who owes whom (from `simplifyDebts`), overall totals per currency, expense rows ("You paid $163.50 · Oct 30", "you lent / you owe"), group sort (needs settling, then new, then settled). ui: `SegmentedControl`.
- **Decision, differs from the design copy:** balances count local changes right away, so adding an expense updates the balance at once. The design's "N changes on this phone aren't counted yet" would be wrong once an edit replaces the synced copy, so the caption reads "includes N changes waiting to sync".
- **Web layout:** sign-in and reset screens use a centered column (480px); app screens use a 720px column on wide windows. Phones are unaffected.
- **Checked in a browser** (390px and 1280px, API on Supabase, seeded demo data matching the designs: $97.00 overall, $109.00 and $12.00, Austin Trip $325.50 total): Home, Groups, Group detail, settled group, Members, Create group (synced), empty Home, offline (API stopped) on Home and group. iOS and Android bundles build; not run on a device.
- **Left for later steps:** Add expense and the "+" (opens a placeholder, 6d), Settle up, invite and join by code, Leave and Delete group, Archive (6e and the gap list). "Needs settling" also lists brand-new groups with no balance yet.
- Fixed on the way: Tailwind did not scan `apps/app/src`, hiding classes only used there.

## Step 6w: web layout — done
- **Reference:** the Web* pages in the design canvas (WebHome, WebGroups, WebGroup, WebAddExpense, WebActivity, WebAccount, WebOffline, WebSignIn). From 1024px wide the app switches to the desktop layout; phones and narrow windows keep the tab bar.
- **Built:** the sidebar shell (logo, Add expense, Home, Groups, Activity, Account, a list of groups with a dot for owed / owe / settled, your profile with the sync state), page headers, Home (wide balance hero, Groups beside Recent expenses), Groups (two-up cards with "who owes you" chips, Settled below), Group detail (Expenses, Balances, Members and History tabs; an expense list with a detail panel showing the split and its history), the offline banner with "N waiting" and "Showing saved data from …", the split-screen sign-in with stacked fields (also used by Create account and the two reset screens, which is my extension of the design; Welcome redirects to sign-in on desktop).
- **Sign-out warning added** (it was planned for 6e and is SPEC): if changes are unsynced, a sheet asks first and says they will be lost.
- **Not built from the web designs yet:** the Add expense dialog and the panel's Edit and Delete (6d); Invite, Settle up and Join with a code (6e); the Activity feed (needs a changes feed on the server, 6f); Account items beyond profile, sync status and sign out (change name and password, delete account, export CSV, default currency, notifications, tools: 6e and 6f). The Balances, Members and History tabs are not drawn in the canvas; I used the same style as the phone screens. History lists payments, deleted expenses and edits made elsewhere (we do not store who made a change, so there are no "Sam added" lines yet).
- **Checked in a browser at 1280px** (API on Supabase) against the canvas: sign-in, Home, Groups, Group detail with the panel, Account, offline. The 390px layout was re-checked and is unchanged. iOS and Android bundles build.
- ui: `FieldRow` and `FieldGroup` have a stacked layout (`FieldLayoutProvider`), `Hero` takes a padding, new token `field-border`.

## Step 6d: expenses — done
- **Screens (phone and web):** Add expense (amount, description, group, paid by, date, notes, category chips, Equally / Exact / Percent with a person list), Choose group ("Add expense to…", last used first, "Create a new group"; skipped with one group), Edit expense (same form, offline notice, "Balances for Riya and Sam will change…"), Expense detail (hero, split, history, Edit, Delete) and the Delete sheet, and the Split error state ("Amounts add up to $80.00. $6.40 short of the total." with "Add $6.40 to Sam" and "Split the rest equally"; Save stays off until it adds up). Tapping an expense on a phone opens its detail; on the web the panel has the same Edit and Delete. Group detail has an Add expense button.
- **Sync states on the expense:** "Waiting to sync" notice; a change the server refused shows the reason with Edit or Discard; a conflict shows what changed (yours and kept) with **Keep theirs / Keep mine** (SPEC wording; the Conflict design's "Got it / Restore my version" was not used, as decided earlier).
- **Core (tests):** `evaluateForm` (parsing, equal / exact / percent, exact-cents errors, the 33.34 / 33.33 / 33.33 rule), fix-up actions, balance-change note, `expenseChanges`, `timeAgo`, categories. ui: `CheckRow`.
- **Checked in a browser** (390px and 1280px, API on Supabase): add with an Exact split that is $6.40 short, fix it, save (balances went $109.00 to $145.40, synced), detail, edit to an equal split, delete (back to $109.00).
- **Not done:** the web Add expense is a centered form, not the canvas's dialog over the group page; the date is picked with Today / Yesterday or typed as YYYY-MM-DD (no calendar picker); By item, the Tip and split calculator, receipt scan, foreign-currency expenses (needs API fields: asked in 6f), and categories as an editable list. Edited-by names ("You edited the amount $160 to $163.50") need the server change feed (6f).
- Fixed on the way: an input's minimum width made the whole form overflow sideways on phones.

## Step 6e (part 1): settle up, invite, join — done
- **Settle up** (`/group/[id]/settle`): from a person's "Settle up" button in Balances (phone and web) or the web header. Shows who pays whom, an amount with "Full balance" and "Half" shortcuts, and "Record payment". The client mirrors the server's limit (the smaller of what the payer owes and what the payee is owed), so an overpayment says "That's more than is owed. The most Sam can pay you is $54.50." before anything is sent. A payment queued offline syncs like any other change. I left out the design's Date row: payments have no date field in the API (the day recorded is the date).
- **Invite** (`/group/[id]/invite`): "Add friends to Austin Trip" with the 8-character code (`JF0H-P0YW`), "Expires in 7 days", Share invite, Copy code. Making a code needs a connection and a group that has synced. **Reset code is not built**: the server has no way to revoke a code yet (6f).
- **Join with a code** (`/join`): Home empty state, Groups, and the web Groups header. Forgiving input (lower case, spaces). Clear messages for a wrong or expired code, no connection, too many tries. **Before an account:** Welcome and the web sign-in have "Have an invite code? Join a group", which asks for the code, then Create account or Sign in, then joins automatically. If that last join fails it does so silently (the code can be entered again from Groups).
- **Core (tests):** `settleLimit`, `directionWith`, `checkSettlement`.
- **Checked in a browser** (390px, API on Supabase): settled $10.00 of Sam's $54.50 (group $109.00 to $99.00, Sam $44.50), overpayment message, invite code, then signed in as the second account and joined with the code typed in lower case with a space; the group and its expenses appeared and the new member sees "not involved".

## Step 6e (part 2): settings, calculator, split by item — done (6e complete)
- **Settings** (Account > Settings): Appearance **System / Light / Dark** (works on web through a `data-theme` override and on native through the OS override; kept across restarts), **Default currency** (used for new groups), **Export as CSV** (expenses and payments; downloads a file on web, opens the share sheet on phones; cells that start like formulas are neutralised), **Clear data on this device** (asks first and counts unsynced changes; you stay signed in and everything downloads again).
- **Tip & split calculator** (Account > Tools): by person (bill, 15/18/20/25% tip, people; $86.40 at 20% for four is $17.28 tip, $103.68 total, $25.92 each) and by item. "Save as expense" opens Add expense with the total filled in.
- **Split by item:** a fourth split option in Add and Edit. Items, who had each, tax and tip; shares are exact to the cent. "Use this split" fills the form with an Exact split and the receipt total, so no new wire format was needed.
- **Core (tests):** `expensesToCsv`, `tipSplit`, `evaluateItemized` and `applyItemized`. ui: `setAppearance` / `useAppearance`.
- **Checked in a browser** (390px, API on Supabase): dark mode and its persistence, CSV contents (including the payment), calculator numbers, by-item split (Ramen $18 for you, Sake $24 shared by Riya and Sam gives $42.00 with 18 / 12 / 12), clear data and re-download.
- **Not built:** the **Simplify debts toggle** (the app always shows the simplified payments; a "without simplifying" view would need a pairwise calculation: gap), notification settings (v1.1 push), the design's date row on settle up, receipt scan (v1.1).

## Step 6w (follow-up): desktop for the secondary pages — done
- **Why:** 6c to 6e were checked mostly at phone size; the pages added after the web designs were still phone screens in a narrow column on desktop.
- **Dialogs (from WebAddExpense):** Add expense, Edit expense, Create group, Settle up, Invite and Join open as a 600px dialog over the dimmed page behind it (a transparent modal route on desktop; the same routes are normal screens on phones). Labeled fields above bordered inputs, "Paid by | Date | Category" in one row, the four split tabs, member rows with avatars, Cancel and Save at the bottom. One shared `FormPage` picks the screen or the dialog; `DesktopDialog` is the dialog.
- **Account (from WebAccount):** two columns. Profile and Session and data on the left, and Settings (appearance, default currency, export, clear data) and Tools on the right, so desktop has no separate Settings page (`/settings` goes to Account; it stays a page on phones). Row actions are text links ("Open", "Sign out").
- **Calculator:** page header with Save as expense, inputs on the left and the result beside them. **Members** and the **expense detail** open inside the group page on desktop (`?tab=Members`, `?expense=<id>`), where the detail panel already lives.
- **Sheets** (pickers, confirmations) now centre on wide screens instead of spanning the window.
- **Checked in a browser** at 1280px and 390px: Account, Add expense, Create group, Invite, Calculator at desktop; Create group and Add expense at phone size (unchanged). Not re-checked at desktop in this pass: Settle up and Join dialogs, the Edit dialog, and the Members and expense redirects (same components as the checked ones).
- **Not dimmed:** the dialog's dim layer covers the content area, not the sidebar (the canvas dims everything).

### Plan from here
6f the gap list: changes feed (Activity), delete account, change password, export CSV, leave, delete and archive group. 6f needs new API endpoints; ask before building them.

## Step 5c: backend structure (SOLID clean-up) — done
- **Layered layout:** `app/api` (routes + `deps.py`), `schemas`, `services`, `repositories`, `domain`, `core`. Moves were their own commit.
- **Routes:** plain module-level `APIRouter`s, one module per resource (accounts, groups, invitations, expenses, settlements, receipts, bill sessions, analytics, health). Authentication is a dependency.
- **DI like Paperwise:** services and repositories declare their dependencies with `Depends(...)` in `__init__` (FastAPI builds the chain); `api/deps.py` shrank to service aliases, auth and the rate limit. `get_settings`, `get_database` (cached) and `get_db` live in `core/`. Unit tests pass mocks to the constructors directly.
- **Transactions and DI:** one `Database` is created on first use by `get_database` (cached) and shared; tests swap it with `app.dependency_overrides`; there is no `create_app` (the app is module-level, run with `uvicorn app.main:app`). `get_db` gives each request one connection/transaction (`scope='function'`, so it commits before the response is sent); repositories are built on it, services on the repositories. No method takes a `db` argument and services open no transactions. (An earlier Unit of Work version was replaced by this at your request.)
- **Split:** `GroupService` became groups, invitations, expenses, settlements and receipts services (plus a membership guard, snapshot builder and image processor). `GroupRepository` became six repositories.
- **Tidy:** bill sessions raise `APIError` like everything else; the metrics token comes from settings; one receipt size constant.
- **Not done (on purpose):** injecting a clock and id generator, and typed records instead of SQLAlchemy `Row`. Nothing needs them yet; revisit if tests need to control time.
- **Tests split:** `backend/tests/unit` (`MagicMock(spec_set=Repository)` mocks created per test class; services, rules, rate limiter, config; no database) and `backend/tests/integration` (the 105 HTTP tests on a real Postgres). Integration tests read `TEST_DATABASE_URL` (a local Postgres), never `DATABASE_URL`, and skip if it is unset. All tests are grouped in `Test…` classes. CI runs both folders.
- **Test layers (all run, all green):** unit 199 in about 5 s (services, routes with stubbed services in `tests/unit/api`, rules, rate limiter, config, money fixtures) and integration 124 in about 100 s (78 HTTP and migration tests, 46 repository tests against real Postgres). The earlier 105 became 78 integration + 27 unit (they never needed a database). The integration run used the Supabase URL passed as `TEST_DATABASE_URL` for that command only, in throwaway `test_*` schemas; a local Postgres would make it a few seconds.
- API contract and database unchanged.
