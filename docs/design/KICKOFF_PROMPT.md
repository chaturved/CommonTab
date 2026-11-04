# Kickoff prompt for Claude Code

Paste this as the first message:

---
Read CLAUDE.md, then docs/design/SPEC.md, DESIGN.md, FLOWS.md and SYNC_ARCHITECTURE.md, then skim docs/design/screens/. We are rebuilding CommonTab as a cross-platform app (Expo + TypeScript) with a FastAPI backend, following that layout. Do not delete the old code; move it to legacy/ as described.

Work in this order, one small PR per step, tests green, and stop after each step with a short summary:
1. Repo restructure: create frontend/ (npm workspace) and backend/ (services/api -> backend, package commontab_api -> app), move apps/ios to legacy/ios and apps/web to website/, fix CI paths and README. No behavior changes.
2. frontend/packages/core: money, splitter (equal, exact, percent, by-item), ledger (balances, simplify debts). Port the Swift tests as golden tests and share JSON fixtures with the backend.
3. frontend/packages/ui: tokens (light and dark) and base components, NativeWind configured for iOS, Android and web.
4. backend: service layer, Postgres + Alembic, tombstones, 409 body with current record, idempotent settlements (no groupVersion requirement), /healthz.
5. core: storage interface, outbox, sync engine against a fake server, with the tests in SYNC_ARCHITECTURE.md.
6. apps/app screens in this order: auth, Home/Groups/Group detail, Add/Edit/Delete expense, sync chip and offline banners, conflicts, settle up, then the rest.
7. website/: update the existing static site to match docs/design/screens/Landing.dc.html and LandingMobile.dc.html.

Before each step, write a short plan (files to move or create, risks) and wait for my OK. After each step, update PROGRESS.md and check the work against the acceptance criteria in SPEC.md. Do not redesign the architecture; if you disagree with SYNC_ARCHITECTURE.md or SPEC.md, tell me first. Ask me before changing the data model or the API contract. Start with step 1.
---
