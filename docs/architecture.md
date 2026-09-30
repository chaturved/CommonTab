# Architecture

SplitTip has two expense stores with different lifecycles. The iOS local archive keeps personal expenses, local groups, itemized details, and receipt photos on one device. The API keeps authenticated group members, shared expenses, balances, settlements, and receipt images in a server database. Importing a local expense into a shared group is an explicit user action; it creates a new server record after the user reviews its payer and split.

## Project layout

```text
SplitTip/
  App/                    App entry point and composition
  Application/            Local expense use cases and store
  Domain/                 Money, expense models, calculations, and parsers
  Data/
    Local/                Archive, receipt files, and Keychain credentials
    Remote/               Typed API clients, DTOs, and analytics
  Features/               SwiftUI screens grouped by user workflow
  Platform/               Camera and on-device OCR adapters
  Resources/              Assets and app configuration
backend/
  splittip_api/
    accounts/             Account models, authentication, routes, repository
    groups/               Group expense rules, persistence, and routes
    bill_sessions/        Temporary itemized bill session API
    analytics/            Anonymous event counters and metrics API
    database.py           Shared SQLite connection and schema
    main.py               App composition and exception handling
  tests/                  HTTP contract and behavior tests
SplitTipTests/            Swift domain, persistence, and client tests
SplitTipUITests/          End-to-end iOS flows
```

## Dependency boundaries

- `SplitTip/Domain` is independent of SwiftUI and persistence. Swift money math, itemized calculations, validation, and local models live here.
- `SplitTip/Application` coordinates local archive and receipt repository interfaces. `SplitTip/Data/Local` implements storage and keeps credentials in the Keychain.
- `SplitTip/Data/Remote` owns HTTP transport and API DTOs. Group expenses, temporary bill sessions, exchange rates, and analytics have separate clients. Views create requests and display server results; they do not compute authoritative shared balances.
- `SplitTip/Features` owns SwiftUI navigation and form state. Screens are grouped by workflow; editors and details have their own files.
- The backend composes four API areas in `main.py`. Each area owns its routes and persistence. `groups/rules.py` contains money allocation and balance rules; `accounts/auth.py` handles bearer tokens. `errors.py` defines the shared API error response.

## Cross-platform contract

The server owns shared group money rules. Clients send integer minor units, a split method, participants in an explicit order, and optional exact-minor-unit or percentage inputs. The server allocates any remainder deterministically and returns each member's share and balance. Group currencies are restricted to USD, EUR, GBP, CAD, AUD, JPY, and INR so future clients can agree on fraction digits. See [shared API](shared-api.md) and the generated `/openapi.json` schema.

Shared expense edits carry the current expense version. A stale edit returns `409` and must be reloaded. Settlement writes carry the current group version. Receipts are available only to group members, are limited to JPEG or PNG under 5 MB, and are never part of anonymous analytics. The iOS app keeps the account bearer token in the Keychain.

Local groups use named members without accounts. They remain separate from shared groups because names cannot safely identify server users. Import transfers an expense amount, description, category, notes, and optional receipt after the user chooses real group members. It does not silently merge local membership or itemized mappings.

## Operational limits

SQLite supports a single API instance for development or a small self-hosted deployment. The current code does not include email delivery, password reset, offline shared writes, push notifications, a production database migration system, or hosted monitoring. A public service needs HTTPS termination, rate limiting, backups, and operational monitoring. These limits are documented so the app does not imply that local data is automatically synced.

The HTTP contract can support a future web or React Native client without sharing Swift source code. No browser client is included yet.
