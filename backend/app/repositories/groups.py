from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text


class GroupRepository:
    """SQL only. Groups: lookup, creation, rename and the version that changes with every write."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def group(self, group_id: UUID, lock: bool = False) -> Row:
        sql = 'SELECT * FROM expense_groups WHERE id=:g' + (' FOR UPDATE' if lock else '')
        return self.connection.execute(text(sql), {'g': group_id}).fetchone()

    def group_ids_for_user(self, user_id: UUID) -> list[UUID]:
        rows = self.connection.execute(text('SELECT group_id FROM members WHERE user_id=:u ORDER BY group_id'),
                          {'u': user_id}).fetchall()
        return [row.group_id for row in rows]

    def insert_group(self, group_id: UUID, name: str, currency: str, owner: UUID,
                     created_at: datetime) -> bool:
        """False when a group with this id already exists."""
        result = self.connection.execute(text('''INSERT INTO expense_groups (id, name, currency_code, owner_id, created_at, version)
                                    VALUES (:id, :name, :currency, :owner, :created_at, 1)
                                    ON CONFLICT (id) DO NOTHING'''),
                            {'id': group_id, 'name': name, 'currency': currency, 'owner': owner,
                             'created_at': created_at})
        return result.rowcount == 1

    def rename_group(self, group_id: UUID, name: str) -> None:
        self.connection.execute(text('UPDATE expense_groups SET name=:name, version=version+1 WHERE id=:g'),
                   {'name': name, 'g': group_id})

    def bump_version(self, group_id: UUID) -> None:
        self.connection.execute(text('UPDATE expense_groups SET version=version+1 WHERE id=:g'), {'g': group_id})
