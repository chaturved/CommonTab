# Flows and rules behind the screens

## Access
- An account is required. First sign-in needs internet (NoConnection). After that the app opens offline from the saved session.
- An expired session shows a sheet (SessionExpired); local data is never locked or lost.
- The server address setting is removed. The base URL is fixed by build configuration (deployed backend).

## Local first and sync
- Every change saves on the device first and joins a queue; the UI shows Synced / pending / failed.
- Each record has a client-generated UUID, so retries never duplicate.
- Edits carry a version number. Deletes leave a marker. Conflicts: newest edit wins and the other person is told (Conflict).
- Balances are computed from an append-only ledger. Money is whole cents. Foreign-currency expenses keep the original amount and the rate used.
- Server down (ServerDown) is separate from no connection: data is safe, changes queue, retry is automatic.

## Groups and members
- A member with an unsettled balance cannot leave (LeaveBlocked). Removed members keep a read-only copy (GroupRemoved).
- Group is archived when settled (GroupSettled).
- Invite by code; a person without an account creates one first, then joins automatically.

## Money
- A split must add up exactly before saving (SplitError). Item splits share tax and tip proportionally, rounded to the cent.
- Simplify debts is a per-group toggle showing fewest payments.
- Repeating expenses are created by the server on schedule.

## Data model changes needed (not done yet)
1. A "me" flag on the group member model, so the app knows which member is the signed-in user.
2. Fixed base URL from build config; delete the server-address setting.
3. Outbox queue with UUIDs, versions, delete markers, and sync status per record.
4. Accessibility identifiers in the UI tests need updating for the new tabs (or rewritten for the new app).
