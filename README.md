# SplitTip

SplitTip is a SwiftUI tip calculator and collaborative receipt splitter. It began as an iOS UIKit prework app and now has a separate money calculation core, on-device receipt recognition, an itemized split editor, and a small FastAPI service for shared bills and aggregate product events.

## What you can do

- Enter a bill, choose one of three editable tip presets, and split the total exactly. Any remainder is assigned in minor currency units so every person's share adds to the total.
- Scan a receipt with the camera or select a photo. Vision recognizes text on-device; the user reviews the suggested total and can edit extracted line items before splitting.
- Assign each item to one or more people. Tax and tip are allocated in proportion to each person's item subtotal.
- Create a seven-day shared bill, send its invite code, and join or update it from another device. The API rejects stale saves with HTTP 409 so a later edit cannot silently overwrite an earlier one.
- Optionally show a dated currency conversion estimate from [Frankfurter](https://frankfurter.dev/).
- Opt in to anonymous event counts. A stable local A/B assignment compares two placements of the receipt scan action. The event payload contains only an allowlisted event name and variant; it contains no receipt, bill, person, or install data.

## Run the app

Use Xcode with an iOS 16 or newer SDK. Open `SplitTip.xcodeproj`, select the `SplitTip` scheme, and run on an iPhone. The photo picker also works without a camera. Camera permission is requested only for taking a photo.

The app defaults to `http://localhost:8000` for the local API. This works when the app and API run on the same Mac simulator host. For a physical device or shared use across devices, set an externally reachable **HTTPS** base URL in Settings. The server must be reachable by every participant. Invite codes grant read and edit access; send them only to intended participants. The app stores the current invite code in the iOS Keychain, while drafts and preferences stay on the device.

## Run the API

Python 3.11 or newer is required. From the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -e './backend[test]'
SPLITTIP_METRICS_TOKEN=replace-with-a-long-secret backend/.venv/bin/uvicorn splittip_api.main:app --app-dir backend --reload
```

The default SQLite database is `backend/data/splittip.sqlite3`. Set `SPLITTIP_DB_PATH` to change it. `POST /v1/sessions` creates a bill and returns an invite token; `GET` and `PUT /v1/sessions/{id}` require that bearer token. Updates include the current version. `POST /v1/events` increments an aggregate count for an allowed event and A/B variant. `GET /v1/metrics` requires `Authorization: Bearer <SPLITTIP_METRICS_TOKEN>` and returns the counts. `/health` reports service health.

For an internet-facing deployment, put the API behind HTTPS, protect and back up the database, set a strong metrics token, and add operational controls such as rate limiting and monitoring. SQLite is suitable for a single service instance; move to a managed database before scaling out. This repository does not include a hosted deployment or real user results.

## Test and validate

```sh
swift test
backend/.venv/bin/pytest -q backend/tests
```

The Swift package tests cover calculation, rounding, locale input, receipt parsing, JSON encoding, shared API requests and conflicts, and event payloads. The API tests cover session lifecycle, authentication, validation, expiry, and protected metrics. The Xcode project also contains a UI test for the calculator and Settings; run it with **Product → Test** when a simulator is available.

CI runs both source test suites and builds the iOS app for a generic simulator destination. It does not run the UI test, which requires a booted simulator. Before distributing a build, complete hands-on camera, photo picker, accessibility, device, and TestFlight checks.

## Project map

| Location | Purpose |
| --- | --- |
| `SplitTip/TipCalculation.swift`, `ItemizedBill.swift` | Decimal money math and exact allocation |
| `SplitTip/Receipt*` | Vision recognition, total and item parsing, review UI |
| `SplitTip/SharedBillClient.swift`, `SharedBillView.swift` | Shared session transport and user flow |
| `SplitTip/ProductAnalytics.swift` | Opt-in anonymous event transport |
| `backend/splittip_api/` | FastAPI validation, SQLite persistence, session and metrics endpoints |
| `SplitTipTests/`, `backend/tests/`, `SplitTipUITests/` | Package, API, and UI tests |

## License

Copyright 2021–2026 Chaturved Lakkaraju. Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
