# CommonTab API

FastAPI service for accounts, shared groups, expenses, settlements, temporary bill sessions and aggregate analytics. Postgres (Supabase in production), Alembic migrations, a layered layout under `app/`:

```
app/main.py          the FastAPI app: error handling, rate limit and routers; settings and database come from api/deps.py on first use
app/api/             deps.py (get_db, repositories, services, current user) and routes/ (one module per resource)
app/schemas/         Pydantic request and response models
app/services/        business rules; no SQL, no HTTP
app/repositories/    SQL only; one class per aggregate
app/domain/          pure rules (allocation, balances, UTC helpers, limits)
app/core/            config, db (engine and transaction), errors, rate limiting, token hashing
```

Each request gets one database transaction from `get_db` (committed before the response is sent, rolled back on error); repositories share its connection and services are built from repositories.

## Run it

From `backend/`:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
cp .env.example .env        # then put your Postgres URL in DATABASE_URL
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

`GET /healthz` should answer `{"status":"ok"}`. The OpenAPI schema is at `/openapi.json`.

## Configuration

Environment variables win over `backend/.env` (which is gitignored; never commit it).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL. For Supabase use the **Session pooler** string (port 5432): it works over IPv4 and supports migrations. |
| `SPLITTIP_METRICS_TOKEN` | Bearer token for `GET /v1/metrics` (kept from the old name). |
| `RATE_LIMIT_AUTH_PER_MINUTE` | Sign-up and sign-in attempts per IP (default 10). |
| `RATE_LIMIT_PER_MINUTE` | Other requests per session (default 600). |
| `TRUST_PROXY` | `true` to read the client IP from `X-Forwarded-For`; only behind a proxy you control. |

Rate limiting is in memory, which is right for one API instance. Move it to a shared store before running several.

## Migrations

The schema lives only in `migrations/versions`. Run `alembic upgrade head` at deploy time; the app does not migrate itself. Create a new revision with `alembic revision -m "what changed"` and write the SQL operations by hand.

## Tests

Two folders, run separately:

```sh
.venv/bin/python -m pytest tests/unit          # no database, about a second
.venv/bin/python -m pytest tests/integration   # route -> service -> repository -> real Postgres
```

- `tests/unit`: services against `unittest.mock` repositories (`create_autospec`, so a wrong method name or argument fails; each test class creates the mocks it needs in an `autouse` `setup` fixture; rows are built in `tests/unit/rows.py`), plus the pure rules, rate limiter and config. Tests are grouped in `Test…` classes.
- `tests/integration`: the HTTP API on a real Postgres. Install one locally (`brew install postgresql@16 && brew services start postgresql@16`), run `createdb commontab_test`, and set `TEST_DATABASE_URL=postgresql://localhost:5432/commontab_test` in `backend/.env`. They never read `DATABASE_URL`, and skip if `TEST_DATABASE_URL` is unset. Each test worker creates a throwaway `test_<random>` schema, migrates it, and drops it at the end; workers run in parallel (`-n 4`).

Shared money fixtures in `../fixtures/money` are also run by the TypeScript core.

The HTTP contract is documented in [`docs/shared-api.md`](../docs/shared-api.md).
