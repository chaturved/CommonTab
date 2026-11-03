from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import text

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


def add_user(connection, email: str | None = None, name: str = 'Ada') -> UUID:
    user_id = uuid4()
    connection.execute(text('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (:i, :e, :n, :h, :c)'),
                       {'i': user_id, 'e': email or f'{user_id}@example.com', 'n': name, 'h': 'x', 'c': NOW})
    return user_id


def add_group(connection, owner: UUID) -> UUID:
    group_id = uuid4()
    connection.execute(text('''INSERT INTO expense_groups (id, name, currency_code, owner_id, created_at, version)
                               VALUES (:i, 'Trip', 'USD', :o, :c, 1)'''), {'i': group_id, 'o': owner, 'c': NOW})
    return group_id


def add_member(connection, group_id: UUID, user_id: UUID | None = None, name: str = 'Ada') -> UUID:
    member_id = uuid4()
    connection.execute(text('INSERT INTO members (id, group_id, user_id, name, created_at) VALUES (:i, :g, :u, :n, :c)'),
                       {'i': member_id, 'g': group_id, 'u': user_id, 'n': name, 'c': NOW})
    return member_id
