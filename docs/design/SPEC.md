# CommonTab product spec

Status: v1 draft. Source of truth for scope and acceptance. Design: `DESIGN.md`, `screens/`. Behavior: `FLOWS.md`. Technical: `SYNC_ARCHITECTURE.md`. If a doc disagrees with this one on scope, this one wins; on technical detail, SYNC_ARCHITECTURE wins.

## Goal
Let friends, roommates and travelers split shared costs fairly to the cent, see who owes whom, and settle up, on iPhone, Android and web, with or without a signal.

## Users
People sharing costs in small groups (2 to 10): trips, apartments, dinners. They add expenses on a phone, often while traveling or with poor signal.

## Non-goals (v1)
Payments or money transfer, bank linking, receipts as legal records, business accounting, groups over 50 members, multi-language UI (English only), tablet-specific layouts.

## Platforms
iOS and Android (Expo), web (Expo web). Marketing site in `website/`. Backend: FastAPI + Postgres.

## Scope
### v1 (must ship)
1. Account: create, sign in, sign out, session expiry, delete account. Password 15+ chars. First sign-in needs internet.
2. Groups: create, invite by code, join with code, members, leave (blocked while owed), delete, archive when settled, removed-member read-only copy.
3. Expenses: add, edit, delete (history kept), payer, split equal / exact / percent / by item, categories, notes, date.
4. Money: whole cents, group currency, foreign-currency expense with stored rate, split must add up exactly, simplify debts toggle.
5. Settle up: record a payment, balances update for everyone.
6. Offline-first sync: local save, outbox, sync chip, offline banners, conflicts (newest wins, other person told), failed-change screen, server-down screen, session-expired sheet.
7. Navigation: Home, Groups, +, Activity, Account tabs; Home shows overall balance.
8. Settings: default currency, notifications, export CSV, clear local data, appearance.
9. Dark mode and large text support.
10. Migration: existing local-only data is uploaded only after the user confirms.

### v1.1 (after launch)
Receipt scan (camera, review, assign), repeating expenses, push notifications and reminders, web push.

### Later
Friends list outside groups, search, charts, more currencies and auto rates, tablet layout.

## Acceptance criteria (examples; each feature needs its own tests)
- A $100.00 bill split 3 ways gives 33.34 / 33.33 / 33.33 and always sums to 10000 cents.
- Airplane mode: add, edit and delete an expense; kill and reopen the app; changes persist and show "waiting to sync". Reconnect: they sync once, with no duplicates.
- Two devices edit the same expense offline: the later edit wins, the earlier editor sees the Conflict screen with Keep mine / Keep theirs.
- A member who owes or is owed money cannot leave; they see LeaveBlocked.
- Deleting an expense updates balances for all members and appears in group history.
- A settlement queued offline never fails with a version error; an overpayment is rejected with a clear message.
- Signing out with pending changes warns first; nothing is lost.
- Every screen matches `screens/*.dc.html` copy, states and tokens; money is always labeled, not only colored.
- Large text: no clipped text. Dark mode: all screens readable (contrast AA).
- Cold start to Home under 2 seconds on a mid-range phone with 200 expenses.

## Non-functional
- Money: integer cents everywhere; shared JSON fixtures keep app and server identical.
- Privacy: tokens in Keychain / Keystore; no tracking SDKs in v1; aggregate analytics only (existing endpoint).
- Reliability: every write has a client UUID (idempotent). Retries with backoff.
- Accessibility: labels on every control, 44pt targets, VoiceOver and TalkBack pass on main flows.
- Test: unit tests for core, API tests for the backend, a UI test per main flow.

## Risks and open questions
1. NativeWind on web and with `.web.tsx` files: check in step 3.
2. Postgres hosting choice (Neon, Supabase, RDS): decide before step 4 ships.
3. Invite by code only, or also by email link? (v1: code.)
4. Currency rates source and licensing (v1.1).
5. Store listings, privacy policy, support email: needed before launch.
6. Trademark check on the name and logo.

## Milestones (map to the kickoff steps)
M1 restructure. M2 core logic with golden tests. M3 UI kit. M4 backend changes. M5 sync engine. M6 app screens (auth, home, groups, expenses, sync UI, settle). M7 website. Then v1.1 features.
