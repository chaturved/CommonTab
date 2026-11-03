from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import Response as RawResponse

from ..accounts.auth import current_user
from ..accounts.service import AccountService
from .models import (AcceptInvitation, ExpenseInput, GroupInput, InvitationInput, MemberInput, RenameGroupInput,
                     SettlementInput)
from .service import GroupService


def router_for(service: GroupService, accounts: AccountService) -> APIRouter:
    router = APIRouter(prefix='/v1')

    def user(authorization: str | None) -> str:
        return current_user(accounts, authorization)

    @router.get('/groups')
    def groups(authorization: str | None = Header(default=None)):
        return service.groups(user(authorization))

    @router.post('/groups', status_code=201)
    def create_group(input: GroupInput, authorization: str | None = Header(default=None)):
        return service.create_group(user(authorization), input)

    @router.get('/groups/{group_id}')
    def group(group_id: UUID, authorization: str | None = Header(default=None)):
        return service.group(str(group_id), user(authorization))

    @router.patch('/groups/{group_id}')
    def rename_group(group_id: UUID, input: RenameGroupInput, authorization: str | None = Header(default=None)):
        return service.rename_group(str(group_id), user(authorization), input.name)

    @router.put('/groups/{group_id}/members/{member_id}')
    def put_member(group_id: UUID, member_id: UUID, input: MemberInput,
                   authorization: str | None = Header(default=None)):
        return service.put_member(str(group_id), str(member_id), user(authorization), input.name)

    @router.post('/groups/{group_id}/invitations', status_code=201)
    def invite(group_id: UUID, input: InvitationInput, authorization: str | None = Header(default=None)):
        return service.invite(str(group_id), user(authorization), input.email)

    @router.post('/invitations/accept')
    def accept(input: AcceptInvitation, authorization: str | None = Header(default=None)):
        return service.accept_invite(user(authorization), input.inviteToken)

    @router.put('/groups/{group_id}/expenses/{expense_id}')
    def save_expense(group_id: UUID, expense_id: UUID, input: ExpenseInput,
                     authorization: str | None = Header(default=None)):
        if expense_id != input.id:
            raise HTTPException(422, 'Expense ID does not match URL')
        return service.save_expense(str(group_id), user(authorization), input)

    @router.delete('/groups/{group_id}/expenses/{expense_id}', status_code=204)
    def delete_expense(group_id: UUID, expense_id: UUID,
                       version: int | None = Query(default=None, ge=1, description='Accepted for older clients; ignored.'),
                       authorization: str | None = Header(default=None)):
        service.delete_expense(str(group_id), str(expense_id), user(authorization))
        return Response(status_code=204)

    @router.post('/groups/{group_id}/settlements', status_code=201)
    def settle(group_id: UUID, input: SettlementInput, response: Response,
               authorization: str | None = Header(default=None)):
        settlement, created = service.settle(str(group_id), user(authorization), input)
        if not created:
            response.status_code = 200  # the same request was already applied
        return settlement

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
        return service.put_receipt(str(group_id), str(expense_id), member, data, request.headers.get('content-type', ''))

    @router.get('/groups/{group_id}/expenses/{expense_id}/receipt')
    def get_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        data, mime = service.get_receipt(str(group_id), str(expense_id), user(authorization))
        return RawResponse(data, media_type=mime, headers={'Cache-Control': 'private, no-store'})

    @router.delete('/groups/{group_id}/expenses/{expense_id}/receipt', status_code=204)
    def delete_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        service.delete_receipt(str(group_id), str(expense_id), user(authorization))
        return Response(status_code=204)

    return router
