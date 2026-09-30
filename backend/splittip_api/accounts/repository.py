from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

from ..errors import fail
from ..database import AppDatabase
from .models import AccountInput


class AccountRepository:
    def __init__(self, db: AppDatabase):
        self.db = db
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
    def public_user(row: sqlite3.Row) -> dict:
        return {'id': row['id'], 'email': row['email'], 'name': row['name']}

    def register(self, input: AccountInput) -> dict:
        email = self.email(input.email)
        name = input.name.strip()
        if not name:
            fail(422, 'Name is required')
        user_id = str(uuid4())
        with self.db.connect() as db:
            try:
                db.execute('INSERT INTO users VALUES (?, ?, ?, ?, ?)',
                           (user_id, email, name, self.passwords.hash(input.password), int(time.time())))
            except sqlite3.IntegrityError:
                fail(409, 'An account with this email already exists')
        return self.login(email, input.password)

    def login(self, email: str, password: str) -> dict:
        with self.db.connect() as db:
            row = db.execute('SELECT * FROM users WHERE email=?', (self.email(email),)).fetchone()
            try:
                if row is None:
                    fail(401, 'Invalid credentials')
                self.passwords.verify(row['password_hash'], password)
            except (VerifyMismatchError, VerificationError):
                fail(401, 'Invalid credentials')
            token = secrets.token_urlsafe(32)
            expires = int(time.time()) + 30 * 24 * 3600
            db.execute('INSERT INTO auth_tokens VALUES (?, ?, ?)', (self.token_hash(token), row['id'], expires))
            return {'accessToken': token, 'expiresAt': datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                    'user': self.public_user(row)}

    def authenticate(self, token: str) -> str:
        with self.db.connect() as db:
            row = db.execute('SELECT user_id, expires_at FROM auth_tokens WHERE token_hash=?',
                             (self.token_hash(token),)).fetchone()
        if not row or row['expires_at'] <= int(time.time()):
            fail(401, 'Invalid or expired session')
        return row['user_id']

    def logout(self, token: str):
        with self.db.connect() as db:
            db.execute('DELETE FROM auth_tokens WHERE token_hash=?', (self.token_hash(token),))

    def me(self, user_id: str) -> dict:
        with self.db.connect() as db:
            row = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
        return self.public_user(row)

    def rename_me(self, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Name is required')
        with self.db.connect() as db:
            db.execute('UPDATE users SET name=? WHERE id=?', (name.strip(), user_id))
        return self.me(user_id)
