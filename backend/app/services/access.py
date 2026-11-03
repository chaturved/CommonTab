from __future__ import annotations

from uuid import UUID

from sqlalchemy import Row

from app.core.errors import fail
from app.repositories.unit_of_work import UnitOfWork


def require_member(uow: UnitOfWork, group_id: UUID, user_id: UUID) -> Row:
    """The member linked to this account. Accounts that are not in the group get 404 (it may not exist)."""
    me = uow.members.member_of(group_id, user_id)
    if me is None:
        fail(404, 'Group not found')
    return me
