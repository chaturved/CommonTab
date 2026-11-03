from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from sqlalchemy import Row

from app.core.errors import fail
from app.core.security import hash_token
from app.domain.emails import normalize_email
from app.repositories.unit_of_work import UnitOfWorkFactory
from app.schemas.accounts import AccountInput

TOKEN_LIFETIME = timedelta(days=30)


class AccountService:
    def __init__(self, uow: UnitOfWorkFactory, passwords: PasswordHasher):
        self.uow = uow
        self.passwords = passwords

    @staticmethod
    def public_user(row: Row) -> dict:
        return {'id': str(row.id), 'email': row.email, 'name': row.name}

    def register(self, input: AccountInput) -> dict:
        email = normalize_email(input.email)
        name = input.name.strip()
        if not name:
            fail(422, 'Name is required')
        password_hash = self.passwords.hash(input.password)
        with self.uow() as uow:
            created = uow.users.insert_user(uuid4(), email, name, password_hash, datetime.now(timezone.utc))
        if not created:
            fail(409, 'An account with this email already exists')
        return self.login(email, input.password)

    def login(self, email: str, password: str) -> dict:
        with self.uow() as uow:
            row = uow.users.user_by_email(normalize_email(email))
            try:
                if row is None:
                    fail(401, 'Invalid credentials')
                self.passwords.verify(row.password_hash, password)
            except (VerifyMismatchError, VerificationError):
                fail(401, 'Invalid credentials')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + TOKEN_LIFETIME
            uow.users.insert_token(hash_token(token), row.id, expires)
            return {'accessToken': token, 'expiresAt': expires.isoformat(), 'user': self.public_user(row)}

    def authenticate(self, token: str) -> str:
        with self.uow() as uow:
            row = uow.users.token(hash_token(token))
        if not row or row.expires_at <= datetime.now(timezone.utc):
            fail(401, 'Invalid or expired session')
        return str(row.user_id)

    def logout(self, token: str) -> None:
        with self.uow() as uow:
            uow.users.delete_token(hash_token(token))

    def me(self, user_id: str) -> dict:
        with self.uow() as uow:
            return self.public_user(uow.users.user_by_id(UUID(user_id)))

    def rename_me(self, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Name is required')
        with self.uow() as uow:
            uow.users.rename(UUID(user_id), name.strip())
            return self.public_user(uow.users.user_by_id(UUID(user_id)))
