from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Connection, Row, text
from sqlalchemy.dialects.postgresql import JSONB


class BillSessionRepository:
    """SQL only. Authorization, expiry and versioning rules live in BillSessionService."""

    def delete_expired(self, db: Connection, now: datetime) -> None:
        db.execute(text('DELETE FROM bill_sessions WHERE expires_at <= :now'), {'now': now})

    _insert = sa.text('''INSERT INTO bill_sessions (id, token_hash, version, bill, expires_at)
                         VALUES (:id, :token_hash, 1, :bill, :expires_at)''').bindparams(sa.bindparam('bill', type_=JSONB))

    def insert(self, db: Connection, session_id: UUID, token_hash: str, bill: dict, expires_at: datetime) -> None:
        db.execute(self._insert, {'id': session_id, 'token_hash': token_hash, 'bill': bill, 'expires_at': expires_at})

    def get(self, db: Connection, session_id: UUID) -> Row | None:
        return db.execute(text('SELECT * FROM bill_sessions WHERE id=:id'), {'id': session_id}).fetchone()

    _update = sa.text('''UPDATE bill_sessions SET bill=:bill, version=version+1
                         WHERE id=:id AND version=:version AND expires_at > :now''').bindparams(
        sa.bindparam('bill', type_=JSONB))

    def update(self, db: Connection, session_id: UUID, version: int, bill: dict, now: datetime) -> bool:
        return db.execute(self._update, {'id': session_id, 'version': version, 'bill': bill, 'now': now}).rowcount == 1
