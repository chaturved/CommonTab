from __future__ import annotations

from uuid import UUID

from sqlalchemy import Row

from fastapi import Depends

from app.core.errors import fail
from app.repositories.members import MemberRepository


class MembershipGuard:
    """Who may see a group: only its members."""

    def __init__(self, members: MemberRepository = Depends(MemberRepository)):
        self.members = members

    def require(self, group_id: UUID, user_id: UUID) -> Row:
        """The member linked to this account. Accounts that are not in the group get 404 (it may not exist)."""
        me = self.members.member_of(group_id, user_id)
        if me is None:
            fail(404, 'Group not found')
        return me
