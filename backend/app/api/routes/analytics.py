from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import AnalyticsDep, Token
from app.core.config import Settings, get_settings
from app.schemas.analytics import ProductEvent

router = APIRouter(prefix='/v1')


@router.post('/events', status_code=202)
def record(event: ProductEvent, analytics: AnalyticsDep) -> dict[str, str]:
    analytics.record(event.name, event.variant)
    return {'status': 'accepted'}


@router.get('/metrics')
def metrics(token: Token, analytics: AnalyticsDep, settings: Settings = Depends(get_settings)) -> dict:
    admin_token = settings.metrics_token
    if not admin_token:
        raise HTTPException(503, 'Metrics access is not configured')
    if not secrets.compare_digest(token, admin_token):
        raise HTTPException(403, 'Invalid metrics token')
    return {'counts': analytics.counts()}
