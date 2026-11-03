from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.core.errors import fail
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.schemas.groups import GroupInput
from app.services.access import MembershipGuard
from app.services.snapshots import SnapshotBuilder, member_payload


class GroupService:
    """Groups and the people in them."""

    def __init__(self, groups: GroupRepository, members: MemberRepository, users: UserRepository,
                 guard: MembershipGuard, snapshots: SnapshotBuilder):
        self.groups = groups
        self.members = members
        self.users = users
        self.guard = guard
        self.snapshots = snapshots

    def group(self, group_id: str, user_id: str) -> dict:
        gid, uid = UUID(group_id), UUID(user_id)
        self.guard.require(gid, uid)
        return self.snapshots.build(gid, uid)

    def list_groups(self, user_id: str) -> list[dict]:
        uid = UUID(user_id)
        return [self.snapshots.build(gid, uid) for gid in self.groups.group_ids_for_user(uid)]

    def create_group(self, user_id: str, input: GroupInput) -> tuple[dict, bool]:
        """
        Create a group; returns (snapshot, created). With a client `id` the call is repeatable: the same
        request again returns the existing group (created=False); the same id with a different body, or
        an id that is someone else's, is a conflict.
        """
        name = input.name.strip()
        if not name:
            fail(422, 'Group name is required')
        group_id = input.id or uuid4()
        uid = UUID(user_id)
        now = datetime.now(timezone.utc)
        if not self.groups.insert_group(group_id, name, input.currency_code, uid, now):
            return self._replay(group_id, uid, name, input), False
        if input.members is None:
            people = [(uuid4(), uid, self.users.user_by_id(uid).name)]
        else:
            people = [(m.id, uid if m.id == input.me_member_id else None, m.name.strip()) for m in input.members]
        for member_id, member_user, member_name in people:
            if not self.members.insert_member(member_id, group_id, member_user, member_name, now):
                fail(409, 'Member ID already in use', 'id_conflict')
        return self.snapshots.build(group_id, uid), True

    def _replay(self, group_id: UUID, uid: UUID, name: str, input: GroupInput) -> dict:
        group = self.groups.group(group_id)
        me = self.members.member_of(group_id, uid)
        if me is None or group.name != name or group.currency_code != input.currency_code:
            fail(409, 'Group ID already in use', 'id_conflict')
        if input.members is not None:
            existing = {m.id: m.name for m in self.members.members(group_id)}
            if me.id != input.me_member_id or any(existing.get(m.id) != m.name.strip() for m in input.members):
                fail(409, 'Group ID already in use', 'id_conflict')
        return self.snapshots.build(group_id, uid)

    def rename_group(self, group_id: str, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Group name is required')
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        self.groups.rename_group(gid, name.strip())
        return self.snapshots.build(gid, UUID(user_id))

    def put_member(self, group_id: str, member_id: str, user_id: str, name: str) -> dict:
        """
        Add a person to the group or rename one (the client chooses the id, so repeating a request is safe).
        A new person has no account until an invitation links one. Names need not be unique; last write wins.
        """
        name = name.strip()
        if not name:
            fail(422, 'Name is required')
        gid, mid = UUID(group_id), UUID(member_id)
        self.guard.require(gid, UUID(user_id))
        existing = self.members.member(mid, lock=True)
        if existing is None:
            self.members.insert_member(mid, gid, None, name, datetime.now(timezone.utc))
            self.groups.bump_version(gid)
        elif existing.group_id != gid:
            fail(409, 'Member ID belongs to another group', 'id_conflict')
        elif existing.name != name:
            self.members.rename_member(mid, name)
            self.groups.bump_version(gid)
        return member_payload(self.members.member(mid))
