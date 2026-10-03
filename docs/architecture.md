# Architecture

CommonTab has two expense stores with different lifecycles. The iOS local archive keeps personal expenses, local groups, itemized details, and receipt photos on one device. The API keeps authenticated group members, shared expenses, balances, settlements, and receipt images in a server database. Importing a local expense into a shared group is an explicit user action; it creates a new server record after the user reviews its payer and split.

## Project layout

```text
apps/
  ios/
    CommonTab/            SwiftUI app, domain, data, and resources
    CommonTabTests/       Swift domain, persistence, and client tests
    CommonTabUITests/     End-to-end iOS flows
    CommonTab.xcodeproj/  Native app project
    Package.swift         Testable core package
  web/
    index.html            Product landing page
    site.css              Product page styling
    app/                  Browser app, styles, and calculator tests
    assets/               Images used by the deployed site
  react-native/           Reserved for a future independent client
services/
  api/
    commontab_api/        Accounts, groups, bill sessions, analytics
    tests/                HTTP contract and behavior tests
    pyproject.toml        Python service package
docs/                     Architecture, API contract, screenshots
scripts/                  Repository utilities
```

## Dependency boundaries

- `apps/ios/CommonTab/Domain` is independent of SwiftUI and persistence. Swift money math, itemized calculations, validation, and local models live here.
- `apps/ios/CommonTab/Application` coordinates local archive and receipt repository interfaces. `Data/Local` implements storage and keeps credentials in the Keychain.
- `apps/ios/CommonTab/Data/Remote` owns HTTP transport and API DTOs. Group expenses, temporary bill sessions, exchange rates, and analytics have separate clients. Views create requests and display server results; they do not compute authoritative shared balances.
- `apps/ios/CommonTab/Features` owns SwiftUI navigation and form state. The four root tabs are Overview, Groups, Expenses, and Tools. Screens are grouped by workflow; `Shared` owns reusable presentation components, while editors and details have their own files.
- `services/api/commontab_api` composes four API areas in `main.py`. Each area owns its routes and persistence. `groups/rules.py` contains money allocation and balance rules; `accounts/auth.py` handles bearer tokens. `errors.py` defines the shared API error response.
- `apps/web` is a static deployment. Its product pages and browser app are separate directories and share only public assets. The browser app currently saves personal expenses on the device and does not call the shared API.

## Cross-platform contract

The server owns shared group money rules. Clients send integer minor units, a split method, participants in an explicit order, and optional exact-minor-unit or percentage inputs. The server allocates any remainder deterministically and returns each member's share and balance. Group currencies are restricted to USD, EUR, GBP, CAD, AUD, JPY, and INR so future clients can agree on fraction digits. See [shared API](shared-api.md) and the generated `/openapi.json` schema.

Shared expense edits carry the current expense version. A stale edit returns `409` and must be reloaded. Settlement writes carry the current group version. Receipts are available only to group members, are limited to JPEG or PNG under 5 MB, and are never part of anonymous analytics. The iOS app keeps the account bearer token in the Keychain.

Local groups use named members without accounts. They remain separate from shared groups because names cannot safely identify server users. Import transfers an expense amount, description, category, notes, and optional receipt after the user chooses real group members. It does not silently merge local membership or itemized mappings.

## Operational limits

SQLite supports a single API instance for development or a small self-hosted deployment. The current code does not include email delivery, password reset, offline shared writes, push notifications, a production database migration system, or hosted monitoring. A public service needs HTTPS termination, rate limiting, backups, and operational monitoring. These limits are documented so the app does not imply that local data is automatically synced.

The HTTP contract can support a future React Native client or a shared-group browser client without sharing Swift source code. The current browser app does not use the API.
