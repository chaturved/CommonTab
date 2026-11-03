# Money fixtures

Shared by `frontend/packages/core` (Jest) and `backend/tests` (pytest). Money is integer minor units (cents); ids are opaque strings.
Each file is an array of cases `{ name, input, expect }` or `{ name, input, error: true }` (the input must be rejected).

| File | Run by | What it checks |
| --- | --- | --- |
| `equal.json`, `exact.json`, `percent.json` | core and backend | `allocation(amount, method, participants, values)`. Input `{method, amount, participants, values}`; `expect` is `[{memberID, minorUnits}]` in participant order. `values` are integer minor units (exact) or decimal strings (percent). |
| `by_item.json` | core | Itemized bill with tax and tip. |
| `ledger.json` | core | Balances from expenses and settlements. |
| `simplify.json` | core | Greedy debt simplification. |

Cases tagged "(Swift golden)" are ported from `legacy/ios/CommonTabTests`. Change a fixture only when the rule itself changes, and change core and backend together.
