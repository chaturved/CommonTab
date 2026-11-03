from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .accounts.repository import AccountRepository
from .accounts.routes import router_for as account_routes
from .analytics.repository import AnalyticsRepository
from .analytics.routes import router_for as analytics_routes
from .bill_sessions.repository import BillSessionRepository
from .bill_sessions.routes import router_for as bill_session_routes
from .errors import APIError
from .database import AppDatabase
from .groups.repository import GroupExpenseRepository
from .groups.routes import router_for as group_routes


def create_app(database_path: Path | None = None, lifetime_seconds: int = 7 * 24 * 60 * 60) -> FastAPI:
    path = database_path or Path(os.environ.get(
        'SPLITTIP_DB_PATH', str(Path(__file__).resolve().parent.parent / 'data' / 'splittip.sqlite3')
    ))
    database = AppDatabase(path)
    accounts = AccountRepository(database)
    groups = GroupExpenseRepository(database, accounts)
    sessions = BillSessionRepository(path, lifetime_seconds=lifetime_seconds)
    analytics = AnalyticsRepository(path)

    app = FastAPI(title='CommonTab API', version='0.2.0')

    @app.exception_handler(APIError)
    def api_error_handler(_request: Request, error: APIError):
        return JSONResponse(status_code=error.status, content={'detail': error.message})

    app.include_router(account_routes(accounts))
    app.include_router(group_routes(groups, accounts))
    app.include_router(bill_session_routes(sessions))
    app.include_router(analytics_routes(analytics))

    @app.get('/health')
    def health() -> dict[str, str]:
        return {'status': 'ok'}

    return app


app = create_app()
