from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes.accounts import router_for as account_routes
from app.services.accounts import AccountService
from app.repositories.analytics import AnalyticsRepository
from app.api.routes.analytics import router_for as analytics_routes
from app.api.routes.bill_sessions import router_for as bill_session_routes
from app.services.bill_sessions import BillSessionService
from app.core.config import Settings, load_settings
from app.core.db import Database, create_db_engine
from app.core.ratelimit import install_rate_limits
from app.core.errors import APIError
from app.api.routes.groups import router_for as group_routes
from app.services.groups import GroupService


def create_app(database: Database | None = None, lifetime_seconds: int = 7 * 24 * 60 * 60,
               settings: Settings | None = None) -> FastAPI:
    """Build the API. Run with `uvicorn app.main:create_app --factory`; tests pass their own database."""
    if database is None:
        settings = settings or load_settings()
        database = Database(create_db_engine(settings.database_url))
    settings = settings or Settings(database_url='')
    accounts = AccountService(database)
    groups = GroupService(database, accounts)
    sessions = BillSessionService(database, lifetime_seconds=lifetime_seconds)
    analytics = AnalyticsRepository(database)

    app = FastAPI(title='CommonTab API', version='0.3.0')

    @app.exception_handler(APIError)
    def api_error_handler(_request: Request, error: APIError):
        return JSONResponse(status_code=error.status, content=error.body())

    install_rate_limits(app, settings)
    app.include_router(account_routes(accounts))
    app.include_router(group_routes(groups, accounts))
    app.include_router(bill_session_routes(sessions))
    app.include_router(analytics_routes(analytics))

    @app.get('/healthz')
    @app.get('/health')  # older name, same behavior
    def health() -> JSONResponse:
        """
        Lets the app tell "server down" from "no connection": 200 when the API can reach its database,
        503 otherwise. Reveals nothing else.
        """
        try:
            database.ping()
        except Exception:
            return JSONResponse(status_code=503, content={'status': 'unavailable'})
        return JSONResponse(content={'status': 'ok'})

    return app
