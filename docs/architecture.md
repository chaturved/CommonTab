# Architecture

SplitTip has two expense stores with different lifecycles. The iOS local archive keeps personal expenses, local groups, itemized details, and receipt photos on one device. The shared API keeps authenticated group members, shared expenses, balances, settlements, and receipt images in a server database. Importing a local expense into a shared group is an explicit user action; it creates a new shared record after the user reviews its payer and split.

## Dependency boundaries

- `SplitTip/Domain`: Swift money math, itemized calculations, validation, and local models. These types have no SwiftUI dependency.
- `SplitTip/Application/ExpenseStore.swift`: coordinates the local archive and receipt repository interfaces.
- `SplitTip/Data/Local`: versioned JSON archive and receipt files in Application Support.
- `SplitTip/Data/Remote/SharedExpenseClient.swift`: typed HTTP transport for the shared API and Keychain token storage. `SharedBillClient.swift` remains a separate temporary bill-session client.
- `SplitTip/Features`: SwiftUI navigation, form state, and user initiated actions. Shared expense views pass drafts to the remote client; the API returns canonical allocations and balances.
- `backend/splittip_api/shared_models.py`: request validation and the `/v1` contract. `shared_storage.py` owns account, membership, split, balance, settlement, and receipt rules. `shared_routes.py` connects HTTP routes to that service. The existing temporary shared-bill session API remains independent.
- `backend/splittip_api/web`: a browser client served from the same origin as the API, so it uses the same account and group rules without a second backend.

## Cross-platform contract

The server owns shared group money rules. Clients send integer minor units, a split method, participants in an explicit order, and optional exact-minor-unit or percentage inputs. The server allocates any remainder deterministically and returns each member's share and balance. Group currencies are restricted to USD, EUR, GBP, CAD, AUD, JPY, and INR so the iOS and browser clients agree on fraction digits. See [shared API](shared-api.md) and the generated `/openapi.json` schema.

Shared expense edits carry the current expense version. A stale edit returns `409` and must be reloaded. Settlement writes carry the current group version. Receipts are available only to group members, are limited to JPEG or PNG under 5 MB, and are never part of anonymous analytics. The iOS app keeps the account bearer token in the Keychain; the browser keeps it in tab session storage.

Local groups use named members without accounts. They remain separate from shared groups because names cannot safely identify server users. Import transfers an expense amount, description, category, notes, and optional receipt after the user chooses real group members. It does not silently merge local membership or itemized mappings.

## Operational limits

SQLite supports a single API instance for development or a small self-hosted deployment. The current code does not include email delivery, password reset, offline shared writes, push notifications, a production database migration system, or hosted monitoring. A public service needs HTTPS termination, rate limiting, backups, and operational monitoring. These limits are documented so the app does not imply that local data is automatically synced.
