from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import ActivityDep, CurrentUser

router = APIRouter(prefix='/v1')


@router.get('/activity')
def activity(user: CurrentUser, service: ActivityDep, since: Annotated[int, Query(ge=0)] = 0,
             limit: Annotated[int, Query(ge=1, le=500)] = 200):
    return service.feed(user, since, limit)
