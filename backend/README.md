# CommonTab API

FastAPI service for accounts, shared groups, expenses, settlements, temporary bill sessions and aggregate analytics. Postgres (Supabase in production), Alembic migrations, a layered layout under `app/`:

```
app/main.py          the FastAPI app: error handling, rate limit and routers; settings and database come from `get_settings` / `get_database` on first use
app/api/             deps.py (service aliases, rate limit, bearer token, current user) and routes/ (one module per resource)
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

## Deploy on Render

`render.yaml` at the repository root describes the service: it builds `backend/Dockerfile`, runs `alembic upgrade head` and then the server on Render's `$PORT`, checks `/healthz`, and redeploys when `backend/` changes on `main`. It runs one instance (the rate limiter is in memory, so do not scale out) on the free plan; a free service may sleep when idle, so the first request after a quiet period can be slow (check Render's current terms, or change `plan`).

Steps:

1. **Rotate the database password** in Supabase (Project Settings > Database), then update your local `backend/.env`.
2. In Render: **New > Blueprint**, connect the `chaturved/CommonTab` repository. Render reads `render.yaml` and asks for the values marked `sync: false`:
   - `DATABASE_URL`: Supabase **Connect > Session pooler** URL (port 5432), with special characters in the password URL-encoded.
   - `RESEND_API_KEY` and `MAIL_FROM`: from resend.com. Verify your sending domain there and use an address on it, for example `CommonTab <no-reply@yourdomain>`. With the default `onboarding@resend.dev` sender, Resend only delivers to your own account's address.
3. When the deploy finishes, open `https://<service>.onrender.com/healthz`: it should answer `{"status":"ok"}`.
4. **Custom domain:** in the service's Settings > Custom Domains add `api.chaturved-sumanth-lakkaraju.com`, and at your DNS provider add the `CNAME` Render shows. Wait for the certificate. Use a sibling subdomain of the site because the session cookie is `SameSite=Lax`.
5. Point the web app at it: set the GitHub repository variable `API_URL` to `https://api.chaturved-sumanth-lakkaraju.com` and enable Pages (see `frontend/apps/app/README.md`).
6. Smoke test on the real site: create an account, create a group, add an expense, make an invite code, ask for a password reset.

`ALLOWED_ORIGINS` is set in `render.yaml` to the site's address; change it there if the site moves. The Dockerfile does not run migrations by itself; the start command in `render.yaml` does, once per start.

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

- `tests/unit`: services against `unittest.mock` repositories (`MagicMock(spec_set=...)`, so a method or attribute the real class lacks fails; each test class creates the mocks it needs in an `autouse` `setup` fixture; rows are built in `tests/unit/rows.py`), plus the pure rules, rate limiter and config. Tests are grouped in `Test…` classes.
- `tests/integration`: the HTTP API on a real Postgres, plus `tests/integration/repositories` (one file per repository, checking the real SQL). Install one locally (`brew install postgresql@16 && brew services start postgresql@16`), run `createdb commontab_test`, and set `TEST_DATABASE_URL=postgresql://localhost:5432/commontab_test` in `backend/.env`. They never read `DATABASE_URL`, and skip if `TEST_DATABASE_URL` is unset. Each test worker creates a throwaway `test_<random>` schema, migrates it, and drops it at the end; workers run in parallel (`-n 4`).

Shared money fixtures in `../fixtures/money` are also run by the TypeScript core.

The HTTP contract is documented in [`docs/shared-api.md`](../docs/shared-api.md).
