from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, InvitationsDep
from app.schemas.groups import AcceptInvitation, InvitationInput

router = APIRouter(prefix='/v1')


@router.post('/groups/{group_id}/invitations', status_code=201)
def invite(group_id: UUID, input: InvitationInput, user: CurrentUser, service: InvitationsDep):
    return service.invite(str(group_id), user, input.email, input.member_id)


@router.post('/invitations/accept')
def accept(input: AcceptInvitation, user: CurrentUser, service: InvitationsDep):
    return service.accept_invite(user, input.inviteToken)
