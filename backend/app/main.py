from __future__ import annotations

from fastapi import Depends, FastAPI

from app.api.deps import enforce_rate_limit
from app.api.errors import install_error_handlers
from app.api.routes import (accounts, analytics, bill_sessions, expenses, groups, health, invitations, receipts,
                            settlements)


# Nothing here reads the environment or opens a connection: settings and the database are created on first use by
# the providers in api/deps.py. Tests swap them with `app.dependency_overrides`. Run with `uvicorn app.main:app`.
app = FastAPI(title='CommonTab API', version='0.3.0', dependencies=[Depends(enforce_rate_limit)])
install_error_handlers(app)
for module in (accounts, groups, invitations, expenses, settlements, receipts, bill_sessions, analytics, health):
    app.include_router(module.router)
