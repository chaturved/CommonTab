from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .accounts.routes import router_for as account_routes
from .accounts.service import AccountService
from .analytics.repository import AnalyticsRepository
from .analytics.routes import router_for as analytics_routes
from .bill_sessions.routes import router_for as bill_session_routes
from .bill_sessions.service import BillSessionService
from .core.config import load_settings
from .core.db import Database, create_db_engine
from .errors import APIError
from .groups.routes import router_for as group_routes
from .groups.service import GroupService


def create_app(database: Database | None = None, lifetime_seconds: int = 7 * 24 * 60 * 60) -> FastAPI:
    """Build the API. Run with `uvicorn app.main:create_app --factory`; tests pass their own database."""
    if database is None:
        database = Database(create_db_engine(load_settings().database_url))
    accounts = AccountService(database)
    groups = GroupService(database, accounts)
    sessions = BillSessionService(database, lifetime_seconds=lifetime_seconds)
    analytics = AnalyticsRepository(database)

    app = FastAPI(title='CommonTab API', version='0.3.0')

    @app.exception_handler(APIError)
    def api_error_handler(_request: Request, error: APIError):
        return JSONResponse(status_code=error.status, content=error.body())

    app.include_router(account_routes(accounts))
    app.include_router(group_routes(groups, accounts))
    app.include_router(bill_session_routes(sessions))
    app.include_router(analytics_routes(analytics))

    @app.get('/health')
    def health() -> dict[str, str]:
        return {'status': 'ok'}

    return app
