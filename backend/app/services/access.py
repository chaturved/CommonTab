from __future__ import annotations

from uuid import UUID

from sqlalchemy import Row

from fastapi import Depends

from app.core.errors import fail
from app.repositories.members import MemberRepository


class MembershipGuard:
    def __init__(self, members: MemberRepository = Depends(MemberRepository)):
        self.members = members

    def require(self, group_id: UUID, user_id: UUID) -> Row:
        me = self.members.member_of(group_id, user_id)
        if me is None:
            fail(404, 'Group not found')
        return me
