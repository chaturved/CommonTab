from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import Depends

from app.core.errors import fail
from app.core.security import hash_token
from app.domain.emails import normalize_email
from app.domain.short_codes import display_code, new_code, normalize_code
from app.repositories.groups import GroupRepository
from app.repositories.invitations import InvitationRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.snapshots import SnapshotBuilder

INVITE_LIFETIME = timedelta(days=7)


class InvitationService:
    def __init__(self, invitations: InvitationRepository = Depends(InvitationRepository),
                 members: MemberRepository = Depends(MemberRepository),
                 groups: GroupRepository = Depends(GroupRepository), users: UserRepository = Depends(UserRepository),
                 guard: MembershipGuard = Depends(MembershipGuard),
                 snapshots: SnapshotBuilder = Depends(SnapshotBuilder)):
        self.invitations = invitations
        self.members = members
        self.groups = groups
        self.users = users
        self.guard = guard
        self.snapshots = snapshots

    def invite(self, group_id: str, user_id: str, email: str, member_id: UUID | None = None) -> dict:
        email = normalize_email(email)
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        if self.members.is_member_email(gid, email):
            fail(409, 'Already a member')
        self._require_unlinked_person(gid, member_id)
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + INVITE_LIFETIME
        self.invitations.insert_invitation(hash_token(token), gid, email, expires, member_id)
        return {'inviteToken': token, 'expiresAt': expires.isoformat(), 'email': email, 'groupID': group_id,
                'memberID': str(member_id) if member_id else None}

    def _require_unlinked_person(self, group_id: UUID, member_id: UUID | None) -> None:
        if member_id is None:
            return
        person = self.members.member(member_id)
        if person is None or person.group_id != group_id:
            fail(422, 'That person is not in this group')
        if person.user_id is not None:
            fail(422, 'That person already has an account')

    def create_code(self, group_id: str, user_id: str, member_id: UUID | None = None) -> dict:
        """
        A short code any signed-in account can join with, for seven days. A code for the whole group can be used
        by many people; a code for one person (`member_id`) links that person to the first account that uses it.
        """
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        self._require_unlinked_person(gid, member_id)
        code = new_code()
        expires = datetime.now(timezone.utc) + INVITE_LIFETIME
        self.invitations.insert_invitation(hash_token(code), gid, None, expires, member_id)
        return {'code': display_code(code), 'expiresAt': expires.isoformat(), 'groupID': group_id,
                'memberID': str(member_id) if member_id else None}

    def join_with_code(self, user_id: str, raw_code: str) -> dict:
        """Join the group a code belongs to. Joining a group you are already in is not an error: you get the group."""
        uid = UUID(user_id)
        code = normalize_code(raw_code)
        if code is None:
            fail(404, 'Invitation missing or expired')
        token_hash = hash_token(code)
        row = self.invitations.invitation(token_hash)
        now = datetime.now(timezone.utc)
        if row is None or row.email is not None or row.expires_at <= now or row.accepted_at is not None:
            fail(404, 'Invitation missing or expired')
        if self.members.member_of(row.group_id, uid) is None:
            if row.member_id is not None:
                person = self.members.member(row.member_id, lock=True)
                if person.user_id is not None:
                    fail(409, 'That person was already linked to an account', 'id_conflict')
                self.members.link_member(person.id, uid)
                self.invitations.accept_invitation(token_hash, now)  # a code for one person works once
            else:
                self.members.insert_member(uuid4(), row.group_id, uid, self.users.user_by_id(uid).name, now)
            self.groups.bump_version(row.group_id)
        return self.snapshots.build(row.group_id, uid)

    def accept_invite(self, user_id: str, token: str) -> dict:
        uid = UUID(user_id)
        token_hash = hash_token(token)
        row = self.invitations.invitation(token_hash)
        email = self.users.user_by_id(uid).email
        now = datetime.now(timezone.utc)
        if row is None or row.email is None or row.expires_at <= now or row.accepted_at is not None:
            fail(404, 'Invitation missing or expired')  # (a code has no email: it goes through /invitations/join)
        if not hmac.compare_digest(row.email, email):
            fail(403, 'Invitation belongs to a different email')
        if self.members.member_of(row.group_id, uid) is not None:
            fail(409, 'Already a member')
        if row.member_id is not None:
            person = self.members.member(row.member_id, lock=True)
            if person.user_id is not None:
                fail(409, 'That person was already linked to an account', 'id_conflict')
            self.members.link_member(person.id, uid)  # past expenses become this account's
        else:
            self.members.insert_member(uuid4(), row.group_id, uid, self.users.user_by_id(uid).name, now)
        self.invitations.accept_invitation(token_hash, now)
        self.groups.bump_version(row.group_id)
        return self.snapshots.build(row.group_id, uid)
