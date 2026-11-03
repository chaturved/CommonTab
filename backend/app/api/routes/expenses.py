from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.deps import CurrentUser, ExpensesDep
from app.schemas.groups import ExpenseInput

router = APIRouter(prefix='/v1')


@router.put('/groups/{group_id}/expenses/{expense_id}')
def save_expense(group_id: UUID, expense_id: UUID, input: ExpenseInput, user: CurrentUser, service: ExpensesDep):
    if expense_id != input.id:
        raise HTTPException(422, 'Expense ID does not match URL')
    return service.save_expense(str(group_id), user, input)


@router.delete('/groups/{group_id}/expenses/{expense_id}', status_code=204)
def delete_expense(group_id: UUID, expense_id: UUID, user: CurrentUser, service: ExpensesDep,
                   version: int | None = Query(default=None, ge=1, description='Accepted for older clients; ignored.')):
    service.delete_expense(str(group_id), str(expense_id), user)
    return Response(status_code=204)
