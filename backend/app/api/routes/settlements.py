from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, SettlementsDep
from app.schemas.groups import SettlementInput

router = APIRouter(prefix='/v1')


@router.post('/groups/{group_id}/settlements', status_code=201)
def settle(group_id: UUID, input: SettlementInput, response: Response, user: CurrentUser, service: SettlementsDep):
    settlement, created = service.settle(str(group_id), user, input)
    if not created:
        response.status_code = 200  # the same request was already applied
    return settlement
