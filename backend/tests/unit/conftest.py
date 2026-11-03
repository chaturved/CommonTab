from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.services.access import MembershipGuard
from app.services.snapshots import SnapshotBuilder
from fakes import FakeExpenses, FakeGroups, FakeInvitations, FakeMembers, FakeSettlements, FakeUsers


@pytest.fixture
def world() -> SimpleNamespace:
    """Fake repositories plus the real guard and snapshot builder over them, with one group of two members."""
    users, groups, members = FakeUsers(), FakeGroups(), FakeMembers()
    expenses, settlements, invitations = FakeExpenses(), FakeSettlements(), FakeInvitations()
    guard = MembershipGuard(members)
    snapshots = SnapshotBuilder(groups, members, expenses, settlements)
    ada, bob = users.add('Ada', 'ada@example.com'), users.add('Bob', 'bob@example.com')
    group_id = uuid4()
    groups.insert_group(group_id, 'Trip', 'USD', ada.id, None)
    ada_member, bob_member = uuid4(), uuid4()
    members.insert_member(ada_member, group_id, ada.id, 'Ada', None)
    members.insert_member(bob_member, group_id, bob.id, 'Bob', None)
    return SimpleNamespace(users=users, groups=groups, members=members, expenses=expenses, settlements=settlements,
                           invitations=invitations, guard=guard, snapshots=snapshots, group_id=group_id,
                           ada=ada, bob=bob, ada_member=ada_member, bob_member=bob_member)
