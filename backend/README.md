# Shared API

The FastAPI service owns accounts, shared groups, bill sessions, balances, and receipts. The iOS app can run without it for personal expenses.

From the repository root:

```sh
python3 -m venv services/api/.venv
services/api/.venv/bin/python -m pip install -e './services/api[test]'
services/api/.venv/bin/python -m uvicorn commontab_api.main:app --app-dir services/api --reload
```

The default database is `services/api/data/splittip.sqlite3`. Set `SPLITTIP_DB_PATH` to override it. Run the HTTP tests with:

```sh
services/api/.venv/bin/python -m pytest -q services/api/tests
```

The HTTP contract is documented in [`docs/shared-api.md`](../../docs/shared-api.md).
