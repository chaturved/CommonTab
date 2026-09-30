from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path


class AppDatabase:
    """SQLite schema and transaction boundary for authenticated expenses."""

    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                    password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                    expires_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS expense_groups (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL,
                    owner_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS group_members (
                    group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    user_id TEXT NOT NULL REFERENCES users(id),
                    PRIMARY KEY (group_id, user_id)
                );
                CREATE TABLE IF NOT EXISTS invitations (
                    token_hash TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    email TEXT NOT NULL, expires_at INTEGER NOT NULL, accepted_at INTEGER
                );
                CREATE TABLE IF NOT EXISTS expenses (
                    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    merchant TEXT NOT NULL, occurred_at TEXT NOT NULL, category TEXT NOT NULL,
                    notes TEXT NOT NULL, amount_minor INTEGER NOT NULL,
                    payer_id TEXT NOT NULL REFERENCES users(id), method TEXT NOT NULL,
                    allocations_json TEXT NOT NULL, values_json TEXT NOT NULL, version INTEGER NOT NULL,
                    receipt BLOB, receipt_type TEXT, updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS expenses_group ON expenses(group_id);
                CREATE TABLE IF NOT EXISTS settlements (
                    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    from_id TEXT NOT NULL REFERENCES users(id), to_id TEXT NOT NULL REFERENCES users(id),
                    amount_minor INTEGER NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS settlements_group ON settlements(group_id);

            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA journal_mode=WAL')
        try:
            with db:
                yield db
        finally:
            db.close()
