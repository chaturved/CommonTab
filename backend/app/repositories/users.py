from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text


class AccountRepository:
    """SQL only. Rules live in AccountService."""

    def insert_user(self, db: Connection, user_id: UUID, email: str, name: str, password_hash: str,
                    created_at: datetime) -> bool:
        """Returns False when the email is already registered."""
        result = db.execute(text('''
            INSERT INTO users (id, email, name, password_hash, created_at)
            VALUES (:id, :email, :name, :hash, :created_at) ON CONFLICT (email) DO NOTHING
        '''), {'id': user_id, 'email': email, 'name': name, 'hash': password_hash, 'created_at': created_at})
        return result.rowcount == 1

    def user_by_email(self, db: Connection, email: str) -> Row | None:
        return db.execute(text('SELECT * FROM users WHERE email=:email'), {'email': email}).fetchone()

    def user_by_id(self, db: Connection, user_id: UUID) -> Row | None:
        return db.execute(text('SELECT * FROM users WHERE id=:id'), {'id': user_id}).fetchone()

    def insert_token(self, db: Connection, token_hash: str, user_id: UUID, expires_at: datetime) -> None:
        db.execute(text('INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (:h, :u, :e)'),
                   {'h': token_hash, 'u': user_id, 'e': expires_at})

    def token(self, db: Connection, token_hash: str) -> Row | None:
        return db.execute(text('SELECT user_id, expires_at FROM auth_tokens WHERE token_hash=:h'),
                          {'h': token_hash}).fetchone()

    def delete_token(self, db: Connection, token_hash: str) -> None:
        db.execute(text('DELETE FROM auth_tokens WHERE token_hash=:h'), {'h': token_hash})

    def rename(self, db: Connection, user_id: UUID, name: str) -> None:
        db.execute(text('UPDATE users SET name=:name WHERE id=:id'), {'name': name, 'id': user_id})
