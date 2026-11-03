from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path


class AnalyticsRepository:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS event_counts (
                name TEXT NOT NULL,
                variant TEXT NOT NULL,
                count INTEGER NOT NULL,
                PRIMARY KEY (name, variant)
            )''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def record(self, name: str, variant: str) -> None:
        with self.connect() as db:
            db.execute(
                'INSERT INTO event_counts (name, variant, count) VALUES (?, ?, 1) '
                'ON CONFLICT(name, variant) DO UPDATE SET count = count + 1',
                (name, variant),
            )

    def counts(self) -> list[dict]:
        with self.connect() as db:
            rows = db.execute('SELECT name, variant, count FROM event_counts ORDER BY name, variant').fetchall()
        return [dict(row) for row in rows]
