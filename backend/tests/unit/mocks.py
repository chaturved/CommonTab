from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import create_autospec

from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.invitations import InvitationRepository
from app.repositories.members import MemberRepository
from app.repositories.settlements import SettlementRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.snapshots import SnapshotBuilder
from rows import member_row


def make_repos() -> SimpleNamespace:
    """
    Autospec'd repositories: a call to a method the real class does not have, or with the wrong arguments, fails.
    The guard is the real one, working on the mocked members repository. `me` is the signed-in member of `group_id`.
    """
    members = create_autospec(MemberRepository, instance=True)
    me = member_row(name='Ada')
    members.member_of.return_value = me
    return SimpleNamespace(
        members=members, groups=create_autospec(GroupRepository, instance=True),
        expenses=create_autospec(ExpenseRepository, instance=True),
        settlements=create_autospec(SettlementRepository, instance=True),
        invitations=create_autospec(InvitationRepository, instance=True),
        users=create_autospec(UserRepository, instance=True),
        snapshots=create_autospec(SnapshotBuilder, instance=True),
        guard=MembershipGuard(members), me=me, group_id=me.group_id, user_id=me.user_id)
