from __future__ import annotations

from sqlalchemy import Connection, text

from app.core.db import DbConnection


class AnalyticsRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def record(self, name: str, variant: str) -> None:
        self.connection.execute(text('''INSERT INTO event_counts (name, variant, count) VALUES (:name, :variant, 1)
                                        ON CONFLICT (name, variant) DO UPDATE SET count = event_counts.count + 1'''),
                                {'name': name, 'variant': variant})

    def counts(self) -> list[dict]:
        rows = self.connection.execute(text('SELECT name, variant, count FROM event_counts ORDER BY name, variant')).fetchall()
        return [{'name': row.name, 'variant': row.variant, 'count': row.count} for row in rows]
