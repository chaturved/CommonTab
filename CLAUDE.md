# CommonTab

Splitwise-style expense splitting. Cross-platform (iOS, Android, web), offline-first, account required.

Read before building: `docs/design/SPEC.md` (scope and acceptance criteria), `docs/design/DESIGN.md`, `docs/design/FLOWS.md`, `docs/design/SYNC_ARCHITECTURE.md`. Screen designs are in `docs/design/screens/*.dc.html` (390x844, inline styles; `canvas.json` lists titles).

## Target layout
- `frontend/` one npm-workspaces TypeScript workspace: `packages/core` (pure TS: money in cents, splitter, ledger, outbox, sync, API client), `packages/ui` (tokens, components), `apps/app` (Expo + Expo Router, iOS/Android/web, NativeWind).
- `backend/` FastAPI (package `app`), Postgres + Alembic, routes/service/repository layers.
- The marketing landing page is part of `apps/app`: it is the web `/` (`src/landing`, designs in `docs/design/screens/Landing*.dc.html`), Home is `/home`, and native `/` redirects to `/home` or `/welcome`. The web build is a static export (`npm run export:web`): the landing page is pre-rendered into `index.html`, app routes load their JavaScript and read the session afterwards; see `frontend/apps/app/README.md` for hosting. The old static `website/` is gone.
- `legacy/ios` (old SwiftUI app) is reference only.
- Today's repo still has `services/api`, `apps/ios`, `apps/web`, `apps/react-native`; migrate per SYNC_ARCHITECTURE.md.

## Rules
- Money is integer cents. Never floats. Port Swift `ExpenseSplitter` and `GroupLedger` with their tests as golden tests; same inputs must give the same cents. Share JSON fixtures with the backend tests.
- `packages/core` has no React, React Native or Node imports; storage, network, clock, and UUIDs are injected.
- Every change saves locally, then goes through the outbox; UI never waits on the network.
- Match the design files (copy, states, colors). Use NativeWind with tokens from `packages/ui`. Rows use min-height, controls have accessibility labels, money is labeled not just colored.
- No code comments or docstrings unless crucial: a hidden reason, an invariant, or a security or data-loss warning (for example why a handler returns instead of raising). Names and tests explain the rest. Tool directives (`noqa`, `@type`, `eslint-disable`) and migration docstrings stay. Do not add comments.
- Work in small PRs, tests green. Ask before changing the data model or the API contract.
