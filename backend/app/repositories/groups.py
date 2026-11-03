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
        rows = self.connection.execute(text('''SELECT m.group_id FROM members m JOIN expense_groups g ON g.id = m.group_id
                                  WHERE m.user_id=:u AND m.removed_at IS NULL AND g.deleted_at IS NULL
                                  ORDER BY m.group_id'''), {'u': user_id}).fetchall()
        return [row.group_id for row in rows]

    def closed_for_user(self, user_id: UUID) -> list[Row]:
        return self.connection.execute(text('''
            SELECT g.id, g.name, CASE WHEN g.deleted_at IS NOT NULL THEN 'deleted' ELSE 'removed' END AS status,
                   COALESCE(g.deleted_at, m.removed_at) AS since
            FROM members m JOIN expense_groups g ON g.id = m.group_id
            WHERE m.user_id=:u AND (m.removed_at IS NOT NULL OR g.deleted_at IS NOT NULL)
            ORDER BY g.id'''), {'u': user_id}).fetchall()

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

    def archive(self, group_id: UUID, now: datetime) -> None:
        self.connection.execute(text('UPDATE expense_groups SET archived_at=:now, version=version+1 WHERE id=:g'),
                                {'now': now, 'g': group_id})

    def unarchive(self, group_id: UUID) -> None:
        self.connection.execute(text('UPDATE expense_groups SET archived_at=NULL, version=version+1 WHERE id=:g'),
                                {'g': group_id})

    def soft_delete(self, group_id: UUID, now: datetime) -> None:
        self.connection.execute(text('UPDATE expense_groups SET deleted_at=:now, version=version+1 WHERE id=:g'),
                                {'now': now, 'g': group_id})
