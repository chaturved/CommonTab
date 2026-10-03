from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import Response as RawResponse

from ..accounts.auth import current_user
from ..accounts.repository import AccountRepository
from .models import AcceptInvitation, ExpenseInput, GroupInput, InvitationInput, RenameGroupInput, SettlementInput
from .repository import GroupExpenseRepository


def router_for(repository: GroupExpenseRepository, accounts: AccountRepository) -> APIRouter:
    router = APIRouter(prefix='/v1')

    def user(authorization: str | None) -> str:
        return current_user(accounts, authorization)

    @router.get('/groups')
    def groups(authorization: str | None = Header(default=None)):
        return repository.groups(user(authorization))

    @router.post('/groups', status_code=201)
    def create_group(input: GroupInput, authorization: str | None = Header(default=None)):
        return repository.create_group(user(authorization), input)

    @router.get('/groups/{group_id}')
    def group(group_id: UUID, authorization: str | None = Header(default=None)):
        return repository.group(str(group_id), user(authorization))

    @router.patch('/groups/{group_id}')
    def rename_group(group_id: UUID, input: RenameGroupInput, authorization: str | None = Header(default=None)):
        return repository.rename_group(str(group_id), user(authorization), input.name)

    @router.post('/groups/{group_id}/invitations', status_code=201)
    def invite(group_id: UUID, input: InvitationInput, authorization: str | None = Header(default=None)):
        return repository.invite(str(group_id), user(authorization), input.email)

    @router.post('/invitations/accept')
    def accept(input: AcceptInvitation, authorization: str | None = Header(default=None)):
        return repository.accept_invite(user(authorization), input.inviteToken)

    @router.put('/groups/{group_id}/expenses/{expense_id}')
    def save_expense(group_id: UUID, expense_id: UUID, input: ExpenseInput,
                     authorization: str | None = Header(default=None)):
        if expense_id != input.id:
            raise HTTPException(422, 'Expense ID does not match URL')
        return repository.save_expense(str(group_id), user(authorization), input)

    @router.delete('/groups/{group_id}/expenses/{expense_id}', status_code=204)
    def delete_expense(group_id: UUID, expense_id: UUID, version: int = Query(ge=1),
                       authorization: str | None = Header(default=None)):
        repository.delete_expense(str(group_id), str(expense_id), user(authorization), version)
        return Response(status_code=204)

    @router.post('/groups/{group_id}/settlements', status_code=201)
    def settle(group_id: UUID, input: SettlementInput, authorization: str | None = Header(default=None)):
        return repository.settle(str(group_id), user(authorization), input)

    @router.put('/groups/{group_id}/expenses/{expense_id}/receipt')
    async def put_receipt(group_id: UUID, expense_id: UUID, request: Request,
                          authorization: str | None = Header(default=None)):
        member = user(authorization)
        content_length = request.headers.get('content-length')
        if content_length:
            try:
                size = int(content_length)
            except ValueError:
                raise HTTPException(400, 'Invalid Content-Length')
            if size > 5 * 1024 * 1024:
                raise HTTPException(413, 'Receipt exceeds 5 MB')
        data = await request.body()
        return repository.put_receipt(str(group_id), str(expense_id), member, data, request.headers.get('content-type', ''))

    @router.get('/groups/{group_id}/expenses/{expense_id}/receipt')
    def get_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        data, mime = repository.get_receipt(str(group_id), str(expense_id), user(authorization))
        return RawResponse(data, media_type=mime, headers={'Cache-Control': 'private, no-store'})

    @router.delete('/groups/{group_id}/expenses/{expense_id}/receipt', status_code=204)
    def delete_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        repository.delete_receipt(str(group_id), str(expense_id), user(authorization))
        return Response(status_code=204)

    return router
