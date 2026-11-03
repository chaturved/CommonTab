# Progress

Branch: `rebuild/cross-platform`. One commit per logical change, messages start with `step N:`; the last commit of each step is tagged `step-N-done`.

## Step 1: repo restructure — done
- `services/api` → `backend` (package `commontab_api` → `app`), `apps/ios` → `legacy/ios`, `apps/web` → `website`, design docs → `docs/design`, `CLAUDE.md` at root.
- `apps/react-native` placeholder removed; `frontend/` npm workspace skeleton added.
- CI, README, docs, `.gitignore` and `scripts/generate_icon.swift` paths updated. No behavior changes.
- Checks: backend 11 tests pass. SPEC acceptance criteria not yet applicable (no new behavior).

## Step 2: `frontend/packages/core` money, splitter, ledger — done
- `money`: currency digits, exact decimal parse/format, `allocateProportionally` (largest remainder, bigint inside).
- `splitter`: equal, exact, percent, by-item with tax and tip. Same rules as the Swift app and `backend/app/groups/rules.py`.
- `ledger`: `computeBalances` (skips tombstones), `simplifyDebts` (greedy, deterministic).
- Shared fixtures in `fixtures/money/`; Swift golden cases ported. Core runs all of them; the backend runs the equal, exact and percent files (`backend/tests/test_money_fixtures.py`). By-item, ledger and simplify exist only in core; the server has no such functions yet.
- Tests: core 116, backend 34 (11 existing, 23 fixtures). CI has a new `frontend` job.
- SPEC check: "$100.00 across 3 gives 33.34 / 33.33 / 33.33, sums to 10000" has a fixture and a unit test. Other criteria depend on later steps.

Notes for later:
- Simplify debts is greedy, not minimal. Exact search for small groups can replace it later; the fixtures and properties stay valid.
- Design bug: `Simplify.dc.html` shows "Sam pays You $5.00" after simplifying, but its four listed payments net to Riya owing $10 and Sam being owed $5. The numbers need fixing in the design copy.
