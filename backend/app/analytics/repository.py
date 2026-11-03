from __future__ import annotations

from sqlalchemy import text

from ..core.db import Database


class AnalyticsRepository:
    """Aggregate counts only: an allowlisted event name and A/B variant, nothing about the user."""

    def __init__(self, db: Database):
        self.db = db

    def record(self, name: str, variant: str) -> None:
        with self.db.transaction() as db:
            db.execute(text('''INSERT INTO event_counts (name, variant, count) VALUES (:name, :variant, 1)
                               ON CONFLICT (name, variant) DO UPDATE SET count = event_counts.count + 1'''),
                       {'name': name, 'variant': variant})

    def counts(self) -> list[dict]:
        with self.db.transaction() as db:
            rows = db.execute(text('SELECT name, variant, count FROM event_counts ORDER BY name, variant')).fetchall()
        return [{'name': row.name, 'variant': row.variant, 'count': row.count} for row in rows]
