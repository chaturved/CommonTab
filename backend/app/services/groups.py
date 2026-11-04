from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import Depends

from app.core.errors import fail
from app.domain.rules import format_utc
from app.repositories.activity import ActivityRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.schemas.groups import GroupInput
from app.services.access import MembershipGuard
from app.services.snapshots import SnapshotBuilder, member_payload


class GroupService:
    def __init__(self, groups: GroupRepository = Depends(GroupRepository),
                 members: MemberRepository = Depends(MemberRepository), users: UserRepository = Depends(UserRepository),
                 guard: MembershipGuard = Depends(MembershipGuard),
                 snapshots: SnapshotBuilder = Depends(SnapshotBuilder),
                 activity: ActivityRepository = Depends(ActivityRepository)):
        self.activity = activity
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
        active = [self.snapshots.build(gid, uid) for gid in self.groups.group_ids_for_user(uid)]
        closed = [{'id': str(row.id), 'name': row.name, 'status': row.status, 'since': format_utc(row.since)}
                  for row in self.groups.closed_for_user(uid)]
        return active + closed

    def create_group(self, user_id: str, input: GroupInput) -> tuple[dict, bool]:
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
        creator = next(member_id for member_id, member_user, _ in people if member_user == uid)
        self.activity.record(group_id, creator, 'group.created', group_id, {'name': name}, now)
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
        name = name.strip()
        if not name:
            fail(422, 'Name is required')
        gid, mid = UUID(group_id), UUID(member_id)
        me = self.guard.require(gid, UUID(user_id))
        existing = self.members.member(mid, lock=True)
        if existing is None:
            now = datetime.now(timezone.utc)
            self.members.insert_member(mid, gid, None, name, now)
            self.activity.record(gid, me.id, 'member.added', mid, {'name': name}, now)
            self.groups.bump_version(gid)
        elif existing.group_id != gid:
            fail(409, 'Member ID belongs to another group', 'id_conflict')
        elif existing.name != name:
            self.members.rename_member(mid, name)
            self.groups.bump_version(gid)
        return member_payload(self.members.member(mid))

    def _my_balance(self, snapshot: dict, member_id: UUID) -> int:
        return next(item['minorUnits'] for item in snapshot['balances'] if item['memberID'] == str(member_id))

    def _require_settled(self, snapshot: dict) -> None:
        if any(item['minorUnits'] != 0 for item in snapshot['balances']):
            fail(409, 'Everyone needs to be settled up first', 'not_settled')

    def _require_owner(self, gid: UUID, uid: UUID) -> None:
        if self.groups.group(gid, lock=True).owner_id != uid:
            fail(403, 'Only the owner can do this', 'not_owner')

    def leave(self, group_id: str, user_id: str) -> None:
        gid, uid = UUID(group_id), UUID(user_id)
        me = self.guard.require(gid, uid)
        balance = self._my_balance(self.snapshots.build(gid, uid), me.id)
        if balance != 0:
            fail(409, 'Settle up before leaving', 'owes_balance', balanceMinor=balance)
        if self.groups.group(gid, lock=True).owner_id == uid:
            others = self.members.other_user_ids(gid, uid)
            if not others:
                fail(409, 'You are the only person with an account here. Delete the group instead.', 'last_account')
            self.groups.set_owner(gid, others[0])
        now = datetime.now(timezone.utc)
        self.members.remove_member(me.id, now)
        self.activity.record(gid, me.id, 'member.left', me.id, {}, now)
        self.groups.bump_version(gid)

    def remove_member(self, group_id: str, member_id: str, user_id: str) -> None:
        gid, uid, mid = UUID(group_id), UUID(user_id), UUID(member_id)
        me = self.guard.require(gid, uid)
        self._require_owner(gid, uid)
        target = self.members.member(mid, lock=True)
        if target is None or target.group_id != gid or target.removed_at is not None:
            fail(404, 'Member not found')
        if target.user_id == uid:
            fail(409, 'Use Leave group to remove yourself', 'use_leave')
        now = datetime.now(timezone.utc)
        self.members.remove_member(mid, now)
        self.activity.record(gid, me.id, 'member.removed', mid, {'name': target.name}, now)
        self.groups.bump_version(gid)

    def archive(self, group_id: str, user_id: str) -> None:
        gid, uid = UUID(group_id), UUID(user_id)
        me = self.guard.require(gid, uid)
        self._require_settled(self.snapshots.build(gid, uid))
        now = datetime.now(timezone.utc)
        self.groups.archive(gid, now)
        self.activity.record(gid, me.id, 'group.archived', gid, {}, now)

    def unarchive(self, group_id: str, user_id: str) -> None:
        gid = UUID(group_id)
        me = self.guard.require(gid, UUID(user_id))
        self.groups.unarchive(gid)
        self.activity.record(gid, me.id, 'group.unarchived', gid, {}, datetime.now(timezone.utc))

    def delete_group(self, group_id: str, user_id: str) -> None:
        gid, uid = UUID(group_id), UUID(user_id)
        self.guard.require(gid, uid)
        self._require_owner(gid, uid)
        self._require_settled(self.snapshots.build(gid, uid))
        self.groups.soft_delete(gid, datetime.now(timezone.utc))
