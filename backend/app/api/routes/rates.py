from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, RatesDep

router = APIRouter(prefix='/v1')


@router.get('/rates')
def rate(user: CurrentUser, service: RatesDep, base: Annotated[str, Query(min_length=3, max_length=3)],
         quote: Annotated[str, Query(min_length=3, max_length=3)]):
    return service.rate(base, quote)
