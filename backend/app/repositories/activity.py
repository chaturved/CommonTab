from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Connection, Row, text
from sqlalchemy.dialects.postgresql import JSONB

from app.core.db import DbConnection


class ActivityRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    _insert = sa.text('''
        INSERT INTO activity (group_id, actor_id, kind, subject_id, data, created_at)
        VALUES (:group_id, :actor_id, :kind, :subject_id, :data, :created_at)
    ''').bindparams(sa.bindparam('data', type_=JSONB))

    def record(self, group_id: UUID, actor_id: UUID | None, kind: str, subject_id: UUID | None, data: dict,
               created_at: datetime) -> None:
        self.connection.execute(self._insert, {'group_id': group_id, 'actor_id': actor_id, 'kind': kind,
                                               'subject_id': subject_id, 'data': data, 'created_at': created_at})

    def since(self, group_ids: list[UUID], after: int, limit: int) -> list[Row]:
        if not group_ids:
            return []
        return self.connection.execute(text('''
            SELECT seq, group_id, actor_id, kind, subject_id, data, created_at FROM activity
            WHERE group_id = ANY(:groups) AND seq > :after ORDER BY seq LIMIT :limit
        '''), {'groups': group_ids, 'after': after, 'limit': limit}).fetchall()
