from __future__ import annotations

from argon2 import PasswordHasher
from fastapi import FastAPI

from app.api.errors import install_error_handlers
from app.api.routes import (accounts, analytics, bill_sessions, expenses, groups, health, invitations, receipts,
                            settlements)
from app.core.config import Settings, load_settings
from app.core.db import Database, create_db_engine
from app.core.ratelimit import install_rate_limits


def create_app(database: Database | None = None, lifetime_seconds: int = 7 * 24 * 60 * 60,
               settings: Settings | None = None) -> FastAPI:
    """Build the API. Run with `uvicorn app.main:create_app --factory`; tests pass their own database."""
    if database is None:
        settings = settings or load_settings()
        database = Database(create_db_engine(settings.database_url))
    settings = settings or Settings(database_url='')

    app = FastAPI(title='CommonTab API', version='0.3.0')
    # Created once and shared by every request.
    app.state.database = database
    app.state.settings = settings
    app.state.password_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
    app.state.bill_session_lifetime_seconds = lifetime_seconds
    install_error_handlers(app)
    install_rate_limits(app, settings)
    for module in (accounts, groups, invitations, expenses, settlements, receipts, bill_sessions, analytics, health):
        app.include_router(module.router)
    return app
