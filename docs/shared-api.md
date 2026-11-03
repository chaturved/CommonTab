# Shared expense API

Base path: `/v1`. Everyone in a group is a **member**: a person with a name who may or may not have an account. Member ids (not account ids) are what expenses, splits, balances and payments refer to. The OpenAPI schema is available at `/openapi.json`. Protected routes require `Authorization: Bearer <accessToken>`. Request and response JSON use camel case for shared expense fields. All money is an integer count of the group's minor currency unit: USD 1250 represents $12.50; JPY 1250 represents ¥1,250.

## Accounts and groups

- `POST /accounts` with `{email,name,password}` creates an account and returns `{accessToken,expiresAt,user}`. Passwords must be at least 15 characters.
- `POST /auth/sessions` with `{email,password}` returns the same session shape. `DELETE /auth/sessions` revokes the current token. Tokens expire after 30 days.
- `GET /me` returns the current account; `PATCH /me` changes its name.
- `GET /healthz` (no login) returns `{"status":"ok"}` when the API can reach its database and `503 {"status":"unavailable"}` when it cannot, so the app can tell "server down" from "no connection". `/health` is an older alias.
- `GET /groups` returns complete group snapshots for the signed-in account. `GET /groups/{groupId}` returns its current snapshot. `PATCH /groups/{groupId}` changes its name.
- A snapshot lists `members`: `{id, name, userID, email}`. `userID` and `email` are `null` for a person without an account. `meMemberID` is the member linked to the signed-in account (the app's "me"), and `ownerID` is the owner's member id.
- `POST /groups` with `{name, currencyCode}` creates a group with the creator as its only member (`201`). Optional fields support uploading a group that already exists on a phone: `id` (a client UUID), `members: [{id, name}]` and `meMemberID` (which of those people is the signed-in account; required with `members`, up to 50 people). Repeating the same request returns `200` with the existing group and creates nothing; the same `id` with a different body, or an id that belongs to someone else's group, returns `409` (`code: "id_conflict"`). A member id already used elsewhere also returns `409` and nothing is created.
- `PUT /groups/{groupId}/members/{memberId}` with `{name}` adds a person without an account, or renames one. The client chooses `memberId`, so repeating a request is safe; any member of the group may call it, names need not be unique, and the last write wins. Returns `200` with the member; the same id in another group returns `409`.
- `POST /groups/{groupId}/invitations` with `{email, memberID?}` returns a private seven-day code. With `memberID` (an existing person who has no account), accepting the invitation links that person to the accepting account, so their past expenses and balance become the account's; without it, accepting adds a new member named after the account. `POST /invitations/accept` with `{inviteToken}` joins only if the signed-in account has that email, and returns `409` if the account is already in the group or the person was linked in the meantime. The application displays the code for private sharing; it does not send email.

## Expenses

`PUT /groups/{groupId}/expenses/{expenseId}` creates or replaces one expense. `payerID` and `participants` are member ids of that group:

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "merchant": "Groceries",
  "occurredAt": "2026-09-30T12:00:00Z",
  "category": "groceries",
  "notes": "",
  "amountMinor": 10001,
  "payerID": "00000000-0000-0000-0000-000000000002",
  "method": "equal",
  "participants": ["00000000-0000-0000-0000-000000000002"],
  "values": [],
  "version": null
}
```

For `exact`, `values` contains one string per participant with integer **minor units**, and its sum must equal `amountMinor`. For `percentage`, the values are decimal percentage strings totaling exactly 100. Equal splits divide whole minor units; remaining units go to participants in request order. Percentage splits use largest remainders with request order breaking ties. The response contains canonical `allocations`, the original `values`, and an incremented `version`. Create with `version: null`; edit with the last version received. A stale or conflicting write returns `409` (see Conflicts and retries).

`DELETE /groups/{groupId}/expenses/{expenseId}` returns `204`. It marks the expense deleted instead of removing it (a *tombstone*) and bumps its version. Delete wins: it succeeds whatever version the caller last saw (`?version=N` is still accepted and ignored), repeating it is a no-op, and deleting an id the server has never seen is also a no-op. Group snapshots return `members`, `expenses` (live only), `deletedExpenses` (tombstones, each a full expense with `deletedAt` set), `settlements`, `balances`, and the group `version`. Balances ignore tombstones. Live expenses have `deletedAt: null`. Every expense record (live, tombstone, or the `current` in a `409`) carries `updatedAt`, the UTC time of its last change on the server; clients use it to decide whose edit is newest. A positive balance means that member is owed money; a negative balance means they owe money. The sum of balances is zero.

## Settlements and receipts

`POST /groups/{groupId}/settlements` accepts `{id,fromID,toID,amountMinor}` and returns `201` with the settlement. `fromID` and `toID` are member ids. The signed-in account must be linked to one of the two. The payer must have a negative balance, the recipient a positive balance, and the amount cannot exceed either outstanding side. These checks run against the balances at the moment the request is applied, never against a group version, so a payment queued offline does not go stale (`groupVersion` is accepted and ignored for older clients). Repeating a request with the same `id` and the same payment returns `200` with the stored settlement and changes nothing; the same `id` with a different payment returns `409` (`code: "id_conflict"`). An amount above what is owed returns `422` with `code: "exceeds_balance"` and `maxAmountMinor`, the most that can be paid (`0` when nothing is owed in that direction).

`PUT /groups/{groupId}/expenses/{expenseId}/receipt` uploads raw JPEG or PNG bytes with the matching `Content-Type`. `GET` returns the image only to group members, and `DELETE` removes it. The 5 MB limit applies to uploads. The server decodes, caps image dimensions, and stores a normalized JPEG without source metadata. Receipt content is excluded from analytics.

## Conflicts and retries

Every write carries a client-generated id, so retrying after a lost response cannot duplicate or conflict with itself:

- `PUT` of an expense whose content equals what the server already stores returns `200` with the stored record (no new version), whatever `version` it carries.
- A `PUT` with different content and a stale `version` (or `version: null` for an id that exists) returns `409`.
- A `PUT` on a deleted expense returns `409` unless its `version` equals the tombstone's version, which **restores** the expense (`deletedAt` becomes `null`, version +1). A replayed create therefore never resurrects a deleted expense.
- Newest edit wins: the client keeps the loser as history and resolves from the `current` record in the `409` body.

## Error behavior

Errors are `{"detail": "..."}`, plus `code` and extra fields where listed. Protected resources return `401` for missing or expired account sessions and `404` when the account is not a member, without revealing whether a group exists. Invalid input returns `422`. Conflicting versions or duplicate identifiers return `409`; expense conflicts add `code: "version_conflict"` and `current`, the server's current record (a tombstone if it was deleted). Other codes: `id_conflict`, `not_found`, `exceeds_balance`, `rate_limited`.

Rate limits: sign-up and sign-in are limited per IP (default 10 a minute), everything else per session (default 600 a minute). Over the limit returns `429` with a `Retry-After` header and `retryAfterSeconds`. Clients treat `429` like a network failure and back off. `/healthz` is never limited.
