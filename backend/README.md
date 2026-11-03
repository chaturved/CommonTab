# Shared API

The FastAPI service owns accounts, shared groups, bill sessions, balances, and receipts. The iOS app can run without it for personal expenses.

From the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e './backend[test]'
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

The default database is `backend/data/splittip.sqlite3`. Set `SPLITTIP_DB_PATH` to override it. Run the HTTP tests with:

```sh
backend/.venv/bin/python -m pytest -q backend/tests
```

The HTTP contract is documented in [`docs/shared-api.md`](../docs/shared-api.md).
