from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class MemberRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def member_of(self, group_id: UUID, user_id: UUID) -> Row | None:
        return self.connection.execute(text('''SELECT m.id, m.name FROM members m JOIN expense_groups g ON g.id = m.group_id
                                  WHERE m.group_id=:g AND m.user_id=:u AND m.removed_at IS NULL AND g.deleted_at IS NULL'''),
                          {'g': group_id, 'u': user_id}).fetchone()

    def members(self, group_id: UUID) -> list[Row]:
        return self.connection.execute(text('''SELECT m.id, m.user_id, m.name, u.email, m.removed_at FROM members m
                                  LEFT JOIN users u ON u.id = m.user_id
                                  WHERE m.group_id=:g ORDER BY m.name, m.id'''), {'g': group_id}).fetchall()

    def member_ids(self, group_id: UUID) -> set[UUID]:
        rows = self.connection.execute(text('SELECT id FROM members WHERE group_id=:g'), {'g': group_id}).fetchall()
        return {row.id for row in rows}

    def insert_member(self, member_id: UUID, group_id: UUID, user_id: UUID | None, name: str,
                      created_at: datetime) -> bool:
        result = self.connection.execute(text('''INSERT INTO members (id, group_id, user_id, name, created_at)
                                    VALUES (:id, :g, :u, :name, :created_at) ON CONFLICT DO NOTHING'''),
                            {'id': member_id, 'g': group_id, 'u': user_id, 'name': name, 'created_at': created_at})
        return result.rowcount == 1

    def member(self, member_id: UUID, lock: bool = False) -> Row | None:
        sql = '''SELECT m.id, m.group_id, m.user_id, m.name, u.email, m.removed_at FROM members m
                 LEFT JOIN users u ON u.id = m.user_id WHERE m.id=:id''' + (' FOR UPDATE OF m' if lock else '')
        return self.connection.execute(text(sql), {'id': member_id}).fetchone()

    def link_member(self, member_id: UUID, user_id: UUID) -> None:
        self.connection.execute(text('UPDATE members SET user_id=:u WHERE id=:id'), {'u': user_id, 'id': member_id})

    def rename_member(self, member_id: UUID, name: str) -> None:
        self.connection.execute(text('UPDATE members SET name=:name WHERE id=:id'), {'name': name, 'id': member_id})

    def is_member_email(self, group_id: UUID, email: str) -> bool:
        return self.connection.execute(text('''SELECT 1 FROM members m JOIN users u ON u.id=m.user_id
                                  WHERE m.group_id=:g AND u.email=:email AND m.removed_at IS NULL'''),
                          {'g': group_id, 'email': email}).fetchone() is not None

    def other_user_ids(self, group_id: UUID, user_id: UUID) -> list[UUID]:
        rows = self.connection.execute(text('''SELECT user_id FROM members
                                  WHERE group_id=:g AND user_id IS NOT NULL AND user_id<>:u AND removed_at IS NULL
                                  ORDER BY created_at, id'''), {'g': group_id, 'u': user_id}).fetchall()
        return [row.user_id for row in rows]

    def unlink_user(self, user_id: UUID) -> None:
        self.connection.execute(text('UPDATE members SET user_id=NULL WHERE user_id=:u'), {'u': user_id})

    def remove_member(self, member_id: UUID, now: datetime) -> None:
        self.connection.execute(text('UPDATE members SET removed_at=:now WHERE id=:id'), {'now': now, 'id': member_id})
