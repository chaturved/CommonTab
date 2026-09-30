# SplitTip

[![CI](https://github.com/chaturved/SplitTip/actions/workflows/ci.yml/badge.svg)](https://github.com/chaturved/SplitTip/actions/workflows/ci.yml)

SplitTip tracks expenses and balances on iOS and in a browser. Its SwiftUI app can save personal expenses and scanned receipts locally. An optional FastAPI service provides accounts, shared groups, expense and receipt sync, settlements, temporary itemized-bill sessions, and aggregate analytics.

## Try it locally

**Requirements:** Xcode with Swift 6 and an iOS 18 or newer SDK. The API requires Python 3.11 or newer.

1. Open `SplitTip.xcodeproj` and run the `SplitTip` scheme on an iPhone simulator or device.
2. The Home screen shows groups, outstanding balances, and recent activity. Open an expense to review its details before editing. Tap **Create group** or **Add expense** to start. Entries and receipt images remain on this device.
3. Tap **View all expenses** to search or edit saved expenses. Open a group to see member balances, expenses, and recorded settlements.
4. Open **Tip and itemized calculator** in Tools for restaurant bills. Enter a bill amount and choose a tip preset or Other for a custom percentage. Tap **Scan receipt** to take or choose a photo, then review the suggested amount and line items before saving them as an expense.
5. For multi-device expenses, start the API below and open **Shared expenses** on Home. Create an account, create a group, and invite another account by email. The invitation code is shown for you to share privately. Add or import an expense, choose its payer and split, and attach a receipt. Group members can open the same group in the iOS app or the browser at `http://localhost:8000/app/`.
6. To use temporary shared itemized bills, open **Tip and itemized calculator → Assign items to people → Share or join a bill**. Create a session and copy its invite code, or join with a code from another device.

The app defaults to `http://localhost:8000` for local development. A simulator on the same Mac can reach that address. For a physical device or collaboration across devices, set a reachable **HTTPS** API URL in Settings on every device.

## Run the API

From the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e './backend[test]'
SPLITTIP_METRICS_TOKEN=replace-with-a-long-secret \
  backend/.venv/bin/python -m uvicorn splittip_api.main:app --app-dir backend --reload
```

Open `http://localhost:8000/` for the browser client or check `http://localhost:8000/health`. The default SQLite file is `backend/data/splittip.sqlite3`; set `SPLITTIP_DB_PATH` to use another location. The same server must be reachable by every device. HTTPS is required outside localhost.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/accounts`, `POST /v1/auth/sessions` | Create an account or sign in |
| `GET /v1/groups`, `POST /v1/groups` | List or create shared groups |
| `POST /v1/groups/{id}/invitations`, `POST /v1/invitations/accept` | Invite an email and join a group |
| `PUT /v1/groups/{id}/expenses/{expenseId}` | Create or edit an expense with server-computed allocations |
| `POST /v1/groups/{id}/settlements` | Record a balance settlement |
| `PUT`, `GET`, `DELETE /v1/groups/{id}/expenses/{expenseId}/receipt` | Manage a private shared receipt |
| `POST /v1/sessions` | Create a seven-day shared bill and return an invite token |
| `GET /v1/sessions/{id}` | Load a bill using its bearer token |
| `PUT /v1/sessions/{id}` | Save a bill with its current version; stale writes return `409` |
| `POST /v1/events` | Increment an allowlisted event and A/B variant count |
| `GET /v1/metrics` | Read aggregate counts using `SPLITTIP_METRICS_TOKEN` |

Shared group requests require an account bearer token. An invitation can be accepted only by the matching email account and expires after seven days. The iOS app keeps its account token in the Keychain; the browser keeps it in tab session storage. An itemized-bill invite code grants read and edit access to that temporary bill, so share it only with intended participants.

## Features and design

- **Exact money math:** `Decimal` calculations and minor-unit remainder allocation keep individual shares equal to the bill total. Itemized tax and tip are allocated in proportion to each person's item subtotal.
- **Receipt review:** Apple's Vision framework recognizes receipt text on the device. The app suggests a total and extracts possible line items; you can correct the amount and item assignments. Personal receipt photos stay on the device. A photo is uploaded only when you attach it to a shared expense or explicitly import that expense into a shared group.
- **Currency estimates:** Optional conversion uses [Frankfurter](https://frankfurter.dev/) and shows the rate date. The displayed conversion is an estimate.
- **Measured changes:** Analytics is off by default. If enabled in Settings, the app sends only an allowlisted event name and a locally assigned A/B variant. The experiment compares two placements of the scan action; the event body has no receipt, bill amount, name, or install identifier.
- **Saved itemized bills:** An itemized calculation can be saved with its line items, exact shares, and scanned receipt image. Its bill people can be mapped to group members so balances reflect item assignments.
- **Expense library and local groups:** Save, search, edit, and delete expenses across categories. Create local groups with named members, assign a payer, split expenses equally, by exact amount, or by percentage, and record settlements. Local data stays in Application Support.
- **Shared groups:** Signed-in members can create and join groups, add and edit expenses, use equal, exact-minor-unit, or percentage splits, record settlements, and upload receipts. The server authorizes membership, computes shares and balances, and rejects stale expense edits. The browser client uses the same API. You can choose a local expense to import into a shared group; review its payer and split before uploading it. Shared groups require a network connection.
- **Local continuity:** Tip presets, appearance, converter settings, and the itemized draft are stored on the device. The quick calculator restores a recent bill for up to ten minutes.

| Area | Source |
| --- | --- |
| App and SwiftUI features | `SplitTip/App`, `SplitTip/Features` (including the expense-first Home screen) |
| Business models, calculations, parsing, validation | `SplitTip/Domain` |
| Expense operations | `SplitTip/Application` |
| Local storage, API clients, analytics | `SplitTip/Data` |
| Camera and on-device OCR | `SplitTip/Platform` |
| Icons, launch screen, configuration | `SplitTip/Resources` |
| API and server storage | `backend/splittip_api` |

## Architecture

The local expense service coordinates validation and separate archive and receipt repositories. Shared group state is authoritative on the server. The iOS and browser clients use `/v1` endpoints and receive server-computed allocations and balances. The OpenAPI contract is at `/openapi.json`; see [architecture](docs/architecture.md) and [shared API contract](docs/shared-api.md).

## Tests and release status

```sh
swift test
backend/.venv/bin/python -m pytest -q backend/tests
```

The Swift package tests cover archive-write rollback, expense persistence, group splits, balances, settlements, archive migration, itemized-to-group mapping, money rounding, receipt parsing, session conflicts, and analytics payloads. API tests cover account authentication, group authorization, invitations, allocations, balances, settlements, receipt access and metadata stripping, temporary sessions, expiry, and metrics. `SplitTipUITests` contains calculator, itemized-flow, and manual-expense and itemized-save tests; run them through **Product → Test** in Xcode when a simulator is available. CI runs the Swift and API tests and builds the iOS app for a generic simulator destination.

The previous calculator, itemized, and local expense UI cases passed on an iPhone 17 Pro simulator. The current shared-expense UI case is written but the full UI suite could not complete locally: Xcode stalled before launching the test runner on both iOS 26.3 and iOS 18.6 simulators. Backend and Swift unit tests and a generic iOS simulator build pass. Manual simulator, physical-device, camera, accessibility, and distribution validation remain. The API has no hosted deployment or real user metrics. The SQLite setup targets one service instance. Before exposing it publicly, add HTTPS termination, rate limiting, monitoring, and backups. Accounts are email and password based; there is no email delivery or password reset yet. Shared expenses require an online connection.

## License

Copyright 2021–2026 Chaturved Lakkaraju. Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
