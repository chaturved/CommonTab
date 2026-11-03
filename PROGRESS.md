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

## Step 3: `frontend/packages/ui` tokens and base components — done
- NativeWind **v4.2.7** (Tailwind 3.4) on Expo SDK 58 / React Native 0.88, as decided. A minimal Expo host in `frontend/apps/app` (config, `/gallery` route) proves the setup; real screens start in step 6.
- Tokens (`tokens.json` + `tokens.ts`), Tailwind preset with CSS variables for light and dark, WCAG AA contrast tests for every text/background pair in both schemes.
- Components: Text, Button, Card, Pill, Banner, SyncChip, AmountText, Avatar, AvatarStack, ListRow, Hero, Sheet, TabBar, Icon. `formatCurrency` added to core.
- Tests: core 126, ui 104 (labels, roles, 44pt minimums, min-height rows, money labeled), backend 34. CI runs frontend typecheck, tests and a web export.
- Verified: web build rendered in a browser at 390 wide in light and dark, including live switching of the system theme and the Sheet. iOS and Android bundles compile.
- SPEC check: dark mode contrast AA (token level, tested); money labeled not only colored (AmountText, tested); 44pt targets and min-height rows (tested); labels on controls (tested).

Not verified yet, so SPEC items stay open:
- **No native run.** Nothing has rendered on an iOS simulator or Android device; the iOS bundle compiles and NativeWind compiled the color variables with light/dark values, but that is not the same as seeing it. Large text (Dynamic Type / font scale) is untested: React Native Web does not scale with browser text size.
- **Manual appearance override** (Settings > appearance) is not built. It needs `Appearance.setColorScheme` on native and a separate approach on web. Planned for the Settings screen in step 6.
- Dark-mode values for warning, error, owe-tint and two extra avatar colors are derived, not from the designs. Please check them against the real dark screens.
- The screen designs use fixed `height: 72px` rows; components use `min-h` instead (per CLAUDE.md).

Decisions recorded: the Conflict screen follows SPEC and SYNC_ARCHITECTURE ("Keep mine" / "Keep theirs"), not the wording in `Conflict.dc.html`.
