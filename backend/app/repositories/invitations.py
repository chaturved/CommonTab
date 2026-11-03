from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class InvitationRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def insert_invitation(self, token_hash: str, group_id: UUID, email: str | None, expires_at: datetime,
                          member_id: UUID | None = None) -> None:
        self.connection.execute(text('''INSERT INTO invitations (token_hash, group_id, email, expires_at, accepted_at, member_id)
                           VALUES (:h, :g, :email, :e, NULL, :m)'''),
                   {'h': token_hash, 'g': group_id, 'email': email, 'e': expires_at, 'm': member_id})

    def invitation(self, token_hash: str) -> Row | None:
        return self.connection.execute(text('SELECT * FROM invitations WHERE token_hash=:h FOR UPDATE'), {'h': token_hash}).fetchone()

    def accept_invitation(self, token_hash: str, accepted_at: datetime) -> None:
        self.connection.execute(text('UPDATE invitations SET accepted_at=:t WHERE token_hash=:h'), {'t': accepted_at, 'h': token_hash})
