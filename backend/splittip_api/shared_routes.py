from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import Response as RawResponse
from pydantic import BaseModel

from .shared_models import (AccountInput, ExpenseInput, GroupInput, InvitationInput, LoginInput,
                            RenameGroupInput, SettlementInput, UpdateProfileInput)
from .shared_storage import SharedError, SharedStore


class AcceptInvitation(BaseModel):
    inviteToken: str


def router_for(store: SharedStore) -> APIRouter:
    router = APIRouter(prefix='/v1')

    def token(authorization: str | None) -> str:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(401, 'Bearer token required')
        return authorization[7:]

    def user(authorization: str | None) -> str:
        return store.authenticate(token(authorization))

    @router.post('/accounts', status_code=201)
    def register(input: AccountInput):
        return store.register(input)

    @router.post('/auth/sessions')
    def login(input: LoginInput):
        return store.login(input.email, input.password)

    @router.delete('/auth/sessions', status_code=204)
    def logout(authorization: str | None = Header(default=None)):
        store.logout(token(authorization))
        return Response(status_code=204)

    @router.get('/me')
    def me(authorization: str | None = Header(default=None)):
        return store.me(user(authorization))

    @router.patch('/me')
    def update_me(input: UpdateProfileInput, authorization: str | None = Header(default=None)):
        return store.rename_me(user(authorization), input.name)

    @router.get('/groups')
    def groups(authorization: str | None = Header(default=None)):
        return store.groups(user(authorization))

    @router.post('/groups', status_code=201)
    def create_group(input: GroupInput, authorization: str | None = Header(default=None)):
        return store.create_group(user(authorization), input)

    @router.get('/groups/{group_id}')
    def group(group_id: UUID, authorization: str | None = Header(default=None)):
        return store.group(str(group_id), user(authorization))

    @router.patch('/groups/{group_id}')
    def rename_group(group_id: UUID, input: RenameGroupInput, authorization: str | None = Header(default=None)):
        return store.rename_group(str(group_id), user(authorization), input.name)

    @router.post('/groups/{group_id}/invitations', status_code=201)
    def invite(group_id: UUID, input: InvitationInput, authorization: str | None = Header(default=None)):
        return store.invite(str(group_id), user(authorization), input.email)

    @router.post('/invitations/accept')
    def accept(input: AcceptInvitation, authorization: str | None = Header(default=None)):
        return store.accept_invite(user(authorization), input.inviteToken)

    @router.put('/groups/{group_id}/expenses/{expense_id}')
    def save_expense(group_id: UUID, expense_id: UUID, input: ExpenseInput,
                     authorization: str | None = Header(default=None)):
        if expense_id != input.id:
            raise HTTPException(422, 'Expense ID does not match URL')
        return store.save_expense(str(group_id), user(authorization), input)

    @router.delete('/groups/{group_id}/expenses/{expense_id}', status_code=204)
    def delete_expense(group_id: UUID, expense_id: UUID, version: int = Query(ge=1),
                       authorization: str | None = Header(default=None)):
        store.delete_expense(str(group_id), str(expense_id), user(authorization), version)
        return Response(status_code=204)

    @router.post('/groups/{group_id}/settlements', status_code=201)
    def settle(group_id: UUID, input: SettlementInput, authorization: str | None = Header(default=None)):
        return store.settle(str(group_id), user(authorization), input)

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
        return store.put_receipt(str(group_id), str(expense_id), member, data, request.headers.get('content-type', ''))

    @router.get('/groups/{group_id}/expenses/{expense_id}/receipt')
    def get_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        data, mime = store.get_receipt(str(group_id), str(expense_id), user(authorization))
        return RawResponse(data, media_type=mime, headers={'Cache-Control': 'private, no-store'})

    @router.delete('/groups/{group_id}/expenses/{expense_id}/receipt', status_code=204)
    def delete_receipt(group_id: UUID, expense_id: UUID, authorization: str | None = Header(default=None)):
        store.delete_receipt(str(group_id), str(expense_id), user(authorization))
        return Response(status_code=204)

    return router
