# Architecture and client expansion

## Current boundaries

- **SwiftUI presentation:** `SplitTip/Features` views own navigation, form state, and platform interactions. Views call use cases rather than opening files or constructing JSON.
- **Domain rules:** `SplitTip/Domain` types own money math and invariants. They have no SwiftUI dependency.
- **Application service:** `SplitTip/Application/ExpenseStore.swift` coordinates group and expense operations. It depends on `ExpenseArchiveRepository` and `ReceiptImageRepository` interfaces, allowing storage implementations to change without changing validation or UI.
- **Local infrastructure:** `SplitTip/Data/Local/ExpensePersistence.swift` reads the versioned local archive; `FileReceiptImageRepository` stores receipt photos. The existing archive format and location are preserved.
- **Remote infrastructure:** `SplitTip/Data/Remote/SharedBillClient.swift` talks to the FastAPI `/v1/sessions` endpoints. The API owns shared-session validation, version checks, and persistence. FastAPI serves its current OpenAPI schema at `/openapi.json`.

## Web or React Native direction

The Swift models are not a cross-platform source of truth. For features used by multiple clients, define the behavior in the versioned API contract and enforce it on the server. A web or React Native client can use the OpenAPI schema to generate types and can implement its own view state. Keep monetary values as decimal strings at the current shared-bill boundary; for future expense and group endpoints, prefer documented integer minor units plus a currency code to avoid floating-point differences. Add shared contract fixtures for rounding, split allocation, validation errors, and concurrent updates before exposing those endpoints.

The current expense archive and receipt images are local to one device. Do not treat the shared-bill session API as an expense-sync API. A future account and sync implementation needs authenticated users, group membership and authorization, receipt upload/download, durable storage, pagination, idempotent writes, and conflict handling. Add a remote expense repository behind an application interface only when that API exists; preserve local data with an explicit migration and offline policy.

## Dependency direction

```text
SwiftUI views -> application operations -> domain rules
                               |-> archive and image repository interfaces
                                    |-> local file implementations

Web / React Native -> versioned HTTP API -> server domain rules -> server storage
Swift shared-bill client -------^
```

The domain rules are intentionally small and testable. Use interfaces at side-effect boundaries (storage and network), not for every model or helper. The local archive is a persistence format, not a public API contract.
