from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class SettlementRepository:
    """SQL only. Payments between members. Append-only."""

    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def settlements(self, group_id: UUID) -> list[Row]:
        return self.connection.execute(text('SELECT * FROM settlements WHERE group_id=:g ORDER BY created_at DESC, id'),
                          {'g': group_id}).fetchall()

    def settlement(self, settlement_id: UUID) -> Row | None:
        return self.connection.execute(text('SELECT * FROM settlements WHERE id=:id'), {'id': settlement_id}).fetchone()

    def insert_settlement(self, settlement_id: UUID, group_id: UUID, from_id: UUID, to_id: UUID,
                          amount: int, created_at: datetime) -> bool:
        result = self.connection.execute(text('''INSERT INTO settlements (id, group_id, from_id, to_id, amount_minor, created_at)
                                    VALUES (:id, :g, :f, :t, :a, :c) ON CONFLICT (id) DO NOTHING'''),
                            {'id': settlement_id, 'g': group_id, 'f': from_id, 't': to_id, 'a': amount, 'c': created_at})
        return result.rowcount == 1
