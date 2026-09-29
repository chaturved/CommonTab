# SplitTip

[![CI](https://github.com/chaturved/SplitTip/actions/workflows/ci.yml/badge.svg)](https://github.com/chaturved/SplitTip/actions/workflows/ci.yml)

SplitTip is an iOS app for calculating tips and splitting an itemized bill. You can enter a total, scan a receipt, assign items to people, and collaborate on a shared bill. The app uses SwiftUI and on-device Vision text recognition; a small FastAPI service handles shared sessions and optional aggregate analytics.

## Try it locally

**Requirements:** Xcode with Swift 6 and an iOS 16 or newer SDK. The API requires Python 3.11 or newer.

1. Open `SplitTip.xcodeproj` and run the `SplitTip` scheme on an iPhone simulator or device.
2. Enter a bill amount and choose a tip preset to see the total and exact per-person shares.
3. Tap **Scan receipt** to take or choose a photo. Review the suggested amount before using it. If line items are detected, review them in the itemized editor and assign them to people.
4. To use shared bills, start the API below, then open **Assign items to people → Share or join a bill**. Create a session and copy its invite code, or join with a code from another device.

The app defaults to `http://localhost:8000` for local development. A simulator on the same Mac can reach that address. For a physical device or collaboration across devices, set a reachable **HTTPS** API URL in Settings on every device.

## Run the API

From the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e './backend[test]'
SPLITTIP_METRICS_TOKEN=replace-with-a-long-secret \
  backend/.venv/bin/python -m uvicorn splittip_api.main:app --app-dir backend --reload
```

Check that it is running with `curl http://localhost:8000/health`. The default SQLite file is `backend/data/splittip.sqlite3`; set `SPLITTIP_DB_PATH` to use another location.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/sessions` | Create a seven-day shared bill and return an invite token |
| `GET /v1/sessions/{id}` | Load a bill using its bearer token |
| `PUT /v1/sessions/{id}` | Save a bill with its current version; stale writes return `409` |
| `POST /v1/events` | Increment an allowlisted event and A/B variant count |
| `GET /v1/metrics` | Read aggregate counts using `SPLITTIP_METRICS_TOKEN` |

An invite code grants read and edit access to its bill. Share it only with intended participants. The app keeps the current code in the iOS Keychain; shared sessions expire after seven days.

## Features and design

- **Exact money math:** `Decimal` calculations and minor-unit remainder allocation keep individual shares equal to the bill total. Itemized tax and tip are allocated in proportion to each person's item subtotal.
- **Receipt review:** Apple's Vision framework recognizes receipt text on the device. The app suggests a total and extracts possible line items; you can correct the amount and item assignments. Receipt photos are not uploaded by SplitTip.
- **Currency estimates:** Optional conversion uses [Frankfurter](https://frankfurter.dev/) and shows the rate date. The displayed conversion is an estimate.
- **Measured changes:** Analytics is off by default. If enabled in Settings, the app sends only an allowlisted event name and a locally assigned A/B variant. The experiment compares two placements of the scan action; the event body has no receipt, bill amount, name, or install identifier.
- **Local continuity:** Tip presets, appearance, converter settings, and the itemized draft are stored on the device. The quick calculator restores a recent bill for up to ten minutes.

| Area | Source |
| --- | --- |
| SwiftUI app and flows | `SplitTip/CalculatorView.swift`, `ReceiptScannerView.swift`, `ItemizedBillView.swift`, `SharedBillView.swift` |
| Calculation and parsing | `SplitTip/TipCalculation.swift`, `ItemizedBill.swift`, `ReceiptAmountParser.swift`, `ReceiptItemParser.swift` |
| Networking and analytics | `SplitTip/SharedBillClient.swift`, `ExchangeRateService.swift`, `ProductAnalytics.swift` |
| API and storage | `backend/splittip_api/main.py`, `models.py`, `storage.py` |

## Tests and release status

```sh
swift test
backend/.venv/bin/python -m pytest -q backend/tests
```

The Swift package tests cover calculations, rounding, input and receipt parsing, session requests, conflicts, and analytics payloads. API tests cover sessions, authentication, validation, expiry, and metrics access. `SplitTipUITests` contains calculator and itemized-flow tests; run them through **Product → Test** in Xcode when a simulator is available. CI runs the Swift and API tests and builds the iOS app for a generic simulator destination.

The automated iOS suite passed on an iPhone 17 Pro simulator running iOS 26.3. Manual simulator, physical-device, camera, accessibility, and TestFlight validation remain. The API has no hosted deployment or real user metrics. Before exposing it publicly, add HTTPS termination, rate limiting, monitoring, backups, and a database suited to the expected scale; the current SQLite setup targets one service instance.

## License

Copyright 2021–2026 Chaturved Lakkaraju. Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
