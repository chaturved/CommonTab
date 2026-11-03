from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class PasswordResetRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def insert(self, code_hash: str, user_id: UUID, expires_at: datetime, created_at: datetime) -> None:
        self.connection.execute(text('''INSERT INTO password_resets (code_hash, user_id, expires_at, created_at)
                                        VALUES (:h, :u, :e, :c)'''),
                                {'h': code_hash, 'u': user_id, 'e': expires_at, 'c': created_at})

    def latest_created_at(self, user_id: UUID) -> datetime | None:
        return self.connection.execute(text('SELECT max(created_at) FROM password_resets WHERE user_id=:u'),
                                       {'u': user_id}).scalar()

    def active(self, user_id: UUID) -> Row | None:
        return self.connection.execute(text('''SELECT * FROM password_resets WHERE user_id=:u AND used_at IS NULL
                                               ORDER BY created_at DESC LIMIT 1 FOR UPDATE'''), {'u': user_id}).fetchone()

    def supersede(self, user_id: UUID, now: datetime) -> None:
        self.connection.execute(text('UPDATE password_resets SET used_at=:now WHERE user_id=:u AND used_at IS NULL'),
                                {'now': now, 'u': user_id})

    def mark_used(self, code_hash: str, now: datetime) -> None:
        self.connection.execute(text('UPDATE password_resets SET used_at=:now WHERE code_hash=:h'),
                                {'now': now, 'h': code_hash})

    def record_failed_attempt(self, code_hash: str) -> int:
        return self.connection.execute(text('''UPDATE password_resets SET attempts = attempts + 1
                                               WHERE code_hash=:h RETURNING attempts'''), {'h': code_hash}).scalar_one()
