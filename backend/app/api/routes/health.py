from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api.deps import ContainerDep

router = APIRouter()


@router.get('/healthz')
@router.get('/health')  # older name, same behavior
def health(container: ContainerDep) -> JSONResponse:
    """
    Lets the app tell "server down" from "no connection": 200 when the API can reach its database,
    503 otherwise. Reveals nothing else.
    """
    try:
        container.database.ping()
    except Exception:
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return JSONResponse(content={'status': 'ok'})
