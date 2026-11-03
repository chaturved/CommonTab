from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import enforce_rate_limit
from app.api.errors import install_error_handlers
from app.api.routes import (accounts, activity, analytics, bill_sessions, expenses, groups, health, invitations,
                            password_resets, receipts, settlements)
from app.core.config import CLIENT_HEADER, allowed_origins


app = FastAPI(title='CommonTab API', version='0.3.0', dependencies=[Depends(enforce_rate_limit)])
install_error_handlers(app)
app.add_middleware(CORSMiddleware, allow_origins=list(allowed_origins()), allow_credentials=True,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                   allow_headers=['Authorization', 'Content-Type', CLIENT_HEADER])
for module in (accounts, activity, password_resets, groups, invitations, expenses, settlements, receipts, bill_sessions, analytics, health):
    app.include_router(module.router)
