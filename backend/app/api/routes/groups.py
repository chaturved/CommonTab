from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, GroupsDep
from app.schemas.groups import GroupInput, MemberInput, RenameGroupInput

router = APIRouter(prefix='/v1')


@router.get('/groups')
def groups(user: CurrentUser, service: GroupsDep):
    return service.list_groups(user)


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
