from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.errors import fail
from app.core.security import hash_token
from app.domain.emails import normalize_email
from app.repositories.unit_of_work import UnitOfWorkFactory
from app.services.access import require_member
from app.services.snapshots import SnapshotBuilder

INVITE_LIFETIME = timedelta(days=7)


class InvitationService:
    def __init__(self, uow: UnitOfWorkFactory, snapshots: SnapshotBuilder):
        self.uow = uow
        self.snapshots = snapshots

    def invite(self, group_id: str, user_id: str, email: str, member_id: UUID | None = None) -> dict:
        email = normalize_email(email)
        gid = UUID(group_id)
        with self.uow() as uow:
            require_member(uow, gid, UUID(user_id))
            if uow.members.is_member_email(gid, email):
                fail(409, 'Already a member')
            if member_id is not None:
                person = uow.members.member(member_id)
                if person is None or person.group_id != gid:
                    fail(422, 'That person is not in this group')
                if person.user_id is not None:
                    fail(422, 'That person already has an account')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + INVITE_LIFETIME
            uow.invitations.insert_invitation(hash_token(token), gid, email, expires, member_id)
        return {'inviteToken': token, 'expiresAt': expires.isoformat(), 'email': email, 'groupID': group_id,
                'memberID': str(member_id) if member_id else None}

    def accept_invite(self, user_id: str, token: str) -> dict:
        uid = UUID(user_id)
        with self.uow() as uow:
            token_hash = hash_token(token)
            row = uow.invitations.invitation(token_hash)
            email = uow.users.user_by_id(uid).email
            now = datetime.now(timezone.utc)
            if row is None or row.expires_at <= now or row.accepted_at is not None:
                fail(404, 'Invitation missing or expired')
            if not hmac.compare_digest(row.email, email):
                fail(403, 'Invitation belongs to a different email')
            if uow.members.member_of(row.group_id, uid) is not None:
                fail(409, 'Already a member')
            if row.member_id is not None:
                person = uow.members.member(row.member_id, lock=True)
                if person.user_id is not None:
                    fail(409, 'That person was already linked to an account', 'id_conflict')
                uow.members.link_member(person.id, uid)  # past expenses become this account's
            else:
                uow.members.insert_member(uuid4(), row.group_id, uid, uow.users.user_by_id(uid).name, now)
            uow.invitations.accept_invitation(token_hash, now)
            uow.groups.bump_version(row.group_id)
            return self.snapshots.build(uow, row.group_id, uid)
