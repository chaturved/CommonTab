from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api.deps import DatabaseDep

router = APIRouter()


@router.get('/healthz')
@router.get('/health')  # older name, same behavior
def health(database: DatabaseDep) -> JSONResponse:
    """
    Lets the app tell "server down" from "no connection": 200 when the API can reach its database,
    503 otherwise. Reveals nothing else.
    """
    try:
        database.ping()
    except Exception:
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return JSONResponse(content={'status': 'ok'})
