# Shared expense API

Base path: `/v1`. The OpenAPI schema is available at `/openapi.json`. Protected routes require `Authorization: Bearer <accessToken>`. Request and response JSON use camel case for shared expense fields. All money is an integer count of the group's minor currency unit: USD 1250 represents $12.50; JPY 1250 represents ¥1,250.

## Accounts and groups

- `POST /accounts` with `{email,name,password}` creates an account and returns `{accessToken,expiresAt,user}`. Passwords must be at least 15 characters.
- `POST /auth/sessions` with `{email,password}` returns the same session shape. `DELETE /auth/sessions` revokes the current token. Tokens expire after 30 days.
- `GET /me` returns the current account; `PATCH /me` changes its name.
- `GET /groups` returns complete group snapshots for the member. `POST /groups` with `{name,currencyCode}` creates one. `GET /groups/{groupId}` returns its current snapshot. `PATCH /groups/{groupId}` changes its name.
- `POST /groups/{groupId}/invitations` with `{email}` returns a private seven-day code. `POST /invitations/accept` with `{inviteToken}` joins only if the signed-in account has that email. The application displays the code for private sharing; it does not send email.

## Expenses

`PUT /groups/{groupId}/expenses/{expenseId}` creates or replaces one expense:

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

For `exact`, `values` contains one string per participant with integer **minor units**, and its sum must equal `amountMinor`. For `percentage`, the values are decimal percentage strings totaling exactly 100. Equal splits divide whole minor units; remaining units go to participants in request order. Percentage splits use largest remainders with request order breaking ties. The response contains canonical `allocations`, the original `values`, and an incremented `version`. Create with `version: null`; edit with the last version received. A stale or conflicting write returns `409`.

`DELETE /groups/{groupId}/expenses/{expenseId}?version=N` requires the current expense version. Group snapshots return `members`, `expenses`, `settlements`, `balances`, and the group `version`. A positive balance means that member is owed money; a negative balance means they owe money. The sum of balances is zero.

## Settlements and receipts

`POST /groups/{groupId}/settlements` accepts `{id,groupVersion,fromID,toID,amountMinor}`. The signed-in member must be one of the participants. The payer must have a negative balance, the recipient a positive balance, and the amount cannot exceed either outstanding side. Stale group versions return `409`.

`PUT /groups/{groupId}/expenses/{expenseId}/receipt` uploads raw JPEG or PNG bytes with the matching `Content-Type`. `GET` returns the image only to group members, and `DELETE` removes it. The 5 MB limit applies to uploads. The server decodes, caps image dimensions, and stores a normalized JPEG without source metadata. Receipt content is excluded from analytics.

## Error behavior

Protected resources return `401` for missing or expired account sessions and `404` when the account is not a member, without revealing whether a group exists. Invalid input returns `422`. Conflicting versions or duplicate identifiers return `409`. Clients should reload the group after a `409` and ask the user to review their change before retrying.
