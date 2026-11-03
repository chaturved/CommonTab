from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from sqlalchemy import Row

from app.core.db import Database
from app.core.errors import fail
from app.schemas.accounts import AccountInput
from app.repositories.users import AccountRepository

TOKEN_LIFETIME = timedelta(days=30)


class AccountService:
    def __init__(self, db: Database, repository: AccountRepository | None = None):
        self.db = db
        self.repository = repository or AccountRepository()
        self.passwords = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

    @staticmethod
    def token_hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def email(value: str) -> str:
        email = value.strip().lower()
        if len(email) > 254 or email.count('@') != 1 or not email.split('@')[0] or '.' not in email.split('@')[1]:
            fail(422, 'Invalid email address')
        return email

    @staticmethod
    def public_user(row: Row) -> dict:
        return {'id': str(row.id), 'email': row.email, 'name': row.name}

    def register(self, input: AccountInput) -> dict:
        email = self.email(input.email)
        name = input.name.strip()
        if not name:
            fail(422, 'Name is required')
        password_hash = self.passwords.hash(input.password)
        with self.db.transaction() as db:
            created = self.repository.insert_user(db, uuid4(), email, name, password_hash, datetime.now(timezone.utc))
        if not created:
            fail(409, 'An account with this email already exists')
        return self.login(email, input.password)

    def login(self, email: str, password: str) -> dict:
        with self.db.transaction() as db:
            row = self.repository.user_by_email(db, self.email(email))
            try:
                if row is None:
                    fail(401, 'Invalid credentials')
                self.passwords.verify(row.password_hash, password)
            except (VerifyMismatchError, VerificationError):
                fail(401, 'Invalid credentials')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + TOKEN_LIFETIME
            self.repository.insert_token(db, self.token_hash(token), row.id, expires)
            return {'accessToken': token, 'expiresAt': expires.isoformat(), 'user': self.public_user(row)}

    def authenticate(self, token: str) -> str:
        with self.db.transaction() as db:
            row = self.repository.token(db, self.token_hash(token))
        if not row or row.expires_at <= datetime.now(timezone.utc):
            fail(401, 'Invalid or expired session')
        return str(row.user_id)

    def logout(self, token: str) -> None:
        with self.db.transaction() as db:
            self.repository.delete_token(db, self.token_hash(token))

    def me(self, user_id: str) -> dict:
        with self.db.transaction() as db:
            return self.public_user(self.repository.user_by_id(db, UUID(user_id)))

    def email_of(self, db, user_id: UUID) -> str:
        return self.repository.user_by_id(db, user_id).email

    def name_of(self, db, user_id: UUID) -> str:
        return self.repository.user_by_id(db, user_id).name

    def rename_me(self, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Name is required')
        with self.db.transaction() as db:
            self.repository.rename(db, UUID(user_id), name.strip())
            return self.public_user(self.repository.user_by_id(db, UUID(user_id)))
