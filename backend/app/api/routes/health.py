from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.db import Database, get_database

router = APIRouter()


@router.get('/healthz')
@router.get('/health')
def health(database: Database = Depends(get_database)) -> JSONResponse:
    try:
        database.ping()
    except Exception:
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return JSONResponse(content={'status': 'ok'})
