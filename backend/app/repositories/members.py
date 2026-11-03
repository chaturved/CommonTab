from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Connection, Row, text


class MemberRepository:
    """SQL only. The people in a group, with or without an account."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def member_of(self, group_id: UUID, user_id: UUID) -> Row | None:
        """The member linked to this account in this group, if any."""
        return self.connection.execute(text('SELECT id, name FROM members WHERE group_id=:g AND user_id=:u'),
                          {'g': group_id, 'u': user_id}).fetchone()

    def members(self, group_id: UUID) -> list[Row]:
        return self.connection.execute(text('''SELECT m.id, m.user_id, m.name, u.email FROM members m
                                  LEFT JOIN users u ON u.id = m.user_id
                                  WHERE m.group_id=:g ORDER BY m.name, m.id'''), {'g': group_id}).fetchall()

    def member_ids(self, group_id: UUID) -> set[UUID]:
        rows = self.connection.execute(text('SELECT id FROM members WHERE group_id=:g'), {'g': group_id}).fetchall()
        return {row.id for row in rows}

    def insert_member(self, member_id: UUID, group_id: UUID, user_id: UUID | None, name: str,
                      created_at: datetime) -> bool:
        """False when the id is taken or the account is already a member of the group."""
        result = self.connection.execute(text('''INSERT INTO members (id, group_id, user_id, name, created_at)
                                    VALUES (:id, :g, :u, :name, :created_at) ON CONFLICT DO NOTHING'''),
                            {'id': member_id, 'g': group_id, 'u': user_id, 'name': name, 'created_at': created_at})
        return result.rowcount == 1

    def member(self, member_id: UUID, lock: bool = False) -> Row | None:
        sql = '''SELECT m.id, m.group_id, m.user_id, m.name, u.email FROM members m
                 LEFT JOIN users u ON u.id = m.user_id WHERE m.id=:id''' + (' FOR UPDATE OF m' if lock else '')
        return self.connection.execute(text(sql), {'id': member_id}).fetchone()

    def link_member(self, member_id: UUID, user_id: UUID) -> None:
        self.connection.execute(text('UPDATE members SET user_id=:u WHERE id=:id'), {'u': user_id, 'id': member_id})

    def rename_member(self, member_id: UUID, name: str) -> None:
        self.connection.execute(text('UPDATE members SET name=:name WHERE id=:id'), {'name': name, 'id': member_id})

    def is_member_email(self, group_id: UUID, email: str) -> bool:
        return self.connection.execute(text('''SELECT 1 FROM members m JOIN users u ON u.id=m.user_id
                                  WHERE m.group_id=:g AND u.email=:email'''),
                          {'g': group_id, 'email': email}).fetchone() is not None
