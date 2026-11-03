from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import Response as RawResponse

from app.api.deps import CurrentUser, GroupsDep
from app.schemas.groups import (AcceptInvitation, ExpenseInput, GroupInput, InvitationInput, MemberInput,
                                RenameGroupInput, SettlementInput)

router = APIRouter(prefix='/v1')


@router.get('/groups')
def groups(user: CurrentUser, service: GroupsDep):
    return service.groups(user)


@router.post('/groups', status_code=201)
def create_group(input: GroupInput, response: Response, user: CurrentUser, service: GroupsDep):
    group, created = service.create_group(user, input)
    if not created:
        response.status_code = 200  # the same request was already applied
    return group


@router.get('/groups/{group_id}')
def group(group_id: UUID, user: CurrentUser, service: GroupsDep):
    return service.group(str(group_id), user)


@router.patch('/groups/{group_id}')
def rename_group(group_id: UUID, input: RenameGroupInput, user: CurrentUser, service: GroupsDep):
    return service.rename_group(str(group_id), user, input.name)


@router.put('/groups/{group_id}/members/{member_id}')
def put_member(group_id: UUID, member_id: UUID, input: MemberInput, user: CurrentUser, service: GroupsDep):
    return service.put_member(str(group_id), str(member_id), user, input.name)


@router.post('/groups/{group_id}/invitations', status_code=201)
def invite(group_id: UUID, input: InvitationInput, user: CurrentUser, service: GroupsDep):
    return service.invite(str(group_id), user, input.email, input.member_id)


@router.post('/invitations/accept')
def accept(input: AcceptInvitation, user: CurrentUser, service: GroupsDep):
    return service.accept_invite(user, input.inviteToken)


@router.put('/groups/{group_id}/expenses/{expense_id}')
def save_expense(group_id: UUID, expense_id: UUID, input: ExpenseInput, user: CurrentUser, service: GroupsDep):
    if expense_id != input.id:
        raise HTTPException(422, 'Expense ID does not match URL')
    return service.save_expense(str(group_id), user, input)


@router.delete('/groups/{group_id}/expenses/{expense_id}', status_code=204)
def delete_expense(group_id: UUID, expense_id: UUID, user: CurrentUser, service: GroupsDep,
                   version: int | None = Query(default=None, ge=1, description='Accepted for older clients; ignored.')):
    service.delete_expense(str(group_id), str(expense_id), user)
    return Response(status_code=204)


@router.post('/groups/{group_id}/settlements', status_code=201)
def settle(group_id: UUID, input: SettlementInput, response: Response, user: CurrentUser, service: GroupsDep):
    settlement, created = service.settle(str(group_id), user, input)
    if not created:
        response.status_code = 200  # the same request was already applied
    return settlement


@router.put('/groups/{group_id}/expenses/{expense_id}/receipt')
async def put_receipt(group_id: UUID, expense_id: UUID, request: Request, user: CurrentUser, service: GroupsDep):
    content_length = request.headers.get('content-length')
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            raise HTTPException(400, 'Invalid Content-Length')
        if size > 5 * 1024 * 1024:
            raise HTTPException(413, 'Receipt exceeds 5 MB')
    data = await request.body()
    return service.put_receipt(str(group_id), str(expense_id), user, data, request.headers.get('content-type', ''))


@router.get('/groups/{group_id}/expenses/{expense_id}/receipt')
def get_receipt(group_id: UUID, expense_id: UUID, user: CurrentUser, service: GroupsDep):
    data, mime = service.get_receipt(str(group_id), str(expense_id), user)
    return RawResponse(data, media_type=mime, headers={'Cache-Control': 'private, no-store'})


@router.delete('/groups/{group_id}/expenses/{expense_id}/receipt', status_code=204)
def delete_receipt(group_id: UUID, expense_id: UUID, user: CurrentUser, service: GroupsDep):
    service.delete_receipt(str(group_id), str(expense_id), user)
    return Response(status_code=204)
