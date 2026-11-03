from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class GroupRepository:
    def __init__(self, connection: Connection = DbConnection):
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

    def set_owner(self, group_id: UUID, user_id: UUID) -> None:
        self.connection.execute(text('UPDATE expense_groups SET owner_id=:u WHERE id=:g'), {'u': user_id, 'g': group_id})

    def delete_group(self, group_id: UUID) -> None:
        for table in ('settlements', 'expenses', 'invitations', 'members'):
            self.connection.execute(text(f'DELETE FROM {table} WHERE group_id=:g'), {'g': group_id})
        self.connection.execute(text('DELETE FROM expense_groups WHERE id=:g'), {'g': group_id})
