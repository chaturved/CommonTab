from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from sqlalchemy import Row

from fastapi import Depends
from app.core.errors import fail
from app.core.security import get_password_hasher, hash_token
from app.domain.emails import normalize_email
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.schemas.accounts import AccountInput

TOKEN_LIFETIME = timedelta(days=30)


class AccountService:
    def __init__(self, users: UserRepository = Depends(UserRepository),
                 passwords: PasswordHasher = Depends(get_password_hasher),
                 groups: GroupRepository = Depends(GroupRepository),
                 members: MemberRepository = Depends(MemberRepository)):
        self.users = users
        self.passwords = passwords
        self.groups = groups
        self.members = members

    @staticmethod
    def public_user(row: Row) -> dict:
        return {'id': str(row.id), 'email': row.email, 'name': row.name}

    def register(self, input: AccountInput) -> dict:
        email = normalize_email(input.email)
        name = input.name.strip()
        if not name:
            fail(422, 'Name is required')
        password_hash = self.passwords.hash(input.password)
        created = self.users.insert_user(uuid4(), email, name, password_hash, datetime.now(timezone.utc))
        if not created:
            fail(409, 'An account with this email already exists')
        return self.login(email, input.password)

    def login(self, email: str, password: str) -> dict:
        row = self.users.user_by_email(normalize_email(email))
        try:
            if row is None:
                fail(401, 'Invalid credentials')
            self.passwords.verify(row.password_hash, password)
        except (VerifyMismatchError, VerificationError):
            fail(401, 'Invalid credentials')
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + TOKEN_LIFETIME
        self.users.insert_token(hash_token(token), row.id, expires)
        return {'accessToken': token, 'expiresAt': expires.isoformat(), 'user': self.public_user(row)}

    def authenticate(self, token: str) -> str:
        row = self.users.token(hash_token(token))
        if not row or row.expires_at <= datetime.now(timezone.utc):
            fail(401, 'Invalid or expired session')
        return str(row.user_id)

    def logout(self, token: str) -> None:
        self.users.delete_token(hash_token(token))

    def me(self, user_id: str) -> dict:
        return self.public_user(self.users.user_by_id(UUID(user_id)))

    def rename_me(self, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Name is required')
        self.users.rename(UUID(user_id), name.strip())
        return self.public_user(self.users.user_by_id(UUID(user_id)))

    def check_password(self, user_id: UUID, password: str) -> None:
        row = self.users.user_by_id(user_id)
        try:
            self.passwords.verify(row.password_hash, password)
        except (VerifyMismatchError, VerificationError):
            fail(403, 'That password is not right', 'wrong_password')

    def change_password(self, user_id: str, token: str, current_password: str, new_password: str) -> None:
        uid = UUID(user_id)
        self.check_password(uid, current_password)
        self.users.set_password(uid, self.passwords.hash(new_password))
        self.users.delete_tokens_except(uid, hash_token(token))

    def delete_account(self, user_id: str, password: str) -> None:
        uid = UUID(user_id)
        self.check_password(uid, password)
        for group_id in self.groups.group_ids_for_user(uid):
            others = self.members.other_user_ids(group_id, uid)
            if not others:
                self.groups.delete_group(group_id)
                continue
            if self.groups.group(group_id).owner_id == uid:
                self.groups.set_owner(group_id, others[0])
            self.groups.bump_version(group_id)
        self.members.unlink_user(uid)
        self.users.delete_tokens_for_user(uid)
        self.users.delete_password_resets(uid)
        self.users.delete_user(uid)
