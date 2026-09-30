from __future__ import annotations

import os
import secrets

from fastapi import APIRouter, Header, HTTPException

from ..accounts.auth import bearer_token
from .models import ProductEvent
from .repository import AnalyticsRepository


def router_for(repository: AnalyticsRepository) -> APIRouter:
    router = APIRouter(prefix='/v1')

    @router.post('/events', status_code=202)
    def record(event: ProductEvent) -> dict[str, str]:
        repository.record(event.name, event.variant)
        return {'status': 'accepted'}

    @router.get('/metrics')
    def metrics(authorization: str | None = Header(default=None)) -> dict:
        admin_token = os.environ.get('SPLITTIP_METRICS_TOKEN')
        if not admin_token:
            raise HTTPException(503, 'Metrics access is not configured')
        if not secrets.compare_digest(bearer_token(authorization), admin_token):
            raise HTTPException(403, 'Invalid metrics token')
        return {'counts': repository.counts()}

    return router
