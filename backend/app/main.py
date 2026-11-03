from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import enforce_rate_limit
from app.api.errors import install_error_handlers
from app.api.routes import (accounts, analytics, bill_sessions, expenses, groups, health, invitations, receipts,
                            settlements)
from app.core.config import CLIENT_HEADER, allowed_origins


# Nothing here reads the environment or opens a connection: settings and the database are created on first use by
# the providers in api/deps.py. Tests swap them with `app.dependency_overrides`. Run with `uvicorn app.main:app`.
app = FastAPI(title='CommonTab API', version='0.3.0', dependencies=[Depends(enforce_rate_limit)])
install_error_handlers(app)
# Web builds of the app call the API from another origin, with the session cookie.
app.add_middleware(CORSMiddleware, allow_origins=list(allowed_origins()), allow_credentials=True,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                   allow_headers=['Authorization', 'Content-Type', CLIENT_HEADER])
for module in (accounts, groups, invitations, expenses, settlements, receipts, bill_sessions, analytics, health):
    app.include_router(module.router)
