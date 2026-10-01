from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from .models import Bill


class SessionMissing(Exception):
    pass


class SessionExpired(Exception):
    pass


class VersionConflict(Exception):
    pass


class BillSessionRepository:
    def __init__(self, path: Path, lifetime_seconds: int = 7 * 24 * 60 * 60):
        self.path = path
        self.lifetime_seconds = lifetime_seconds
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    token_hash TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    bill_json TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                )"""
            )

    @contextmanager
    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _payload(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "version": row["version"],
            "expiresAt": datetime.fromtimestamp(row["expires_at"], timezone.utc).isoformat(),
            "bill": json.loads(row["bill_json"]),
        }

    def create(self, bill: Bill) -> dict:
        session_id = uuid4()
        token = secrets.token_urlsafe(32)
        expiry = int(time.time()) + self.lifetime_seconds
        bill_json = bill.model_dump_json(by_alias=True)
        with self._connect() as db:
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
            db.execute(
                "INSERT INTO sessions (id, token_hash, version, bill_json, expires_at) VALUES (?, ?, 1, ?, ?)",
                (str(session_id), self._hash(token), bill_json, expiry),
            )
        return {
            "id": session_id,
            "accessToken": token,
            "version": 1,
            "expiresAt": datetime.fromtimestamp(expiry, timezone.utc).isoformat(),
            "bill": bill.model_dump(mode="json", by_alias=True),
        }

    def get(self, session_id: UUID, token: str) -> dict:
        with self._connect() as db:
            row = db.execute("SELECT * FROM sessions WHERE id = ?", (str(session_id),)).fetchone()
        self._authorize(row, token)
        return self._payload(row)

    def update(self, session_id: UUID, token: str, version: int, bill: Bill) -> dict:
        with self._connect() as db:
            row = db.execute("SELECT * FROM sessions WHERE id = ?", (str(session_id),)).fetchone()
            self._authorize(row, token)
            cursor = db.execute(
                "UPDATE sessions SET bill_json = ?, version = version + 1 "
                "WHERE id = ? AND version = ? AND expires_at > ?",
                (bill.model_dump_json(by_alias=True), str(session_id), version, int(time.time())),
            )
            if cursor.rowcount != 1:
                raise VersionConflict
            updated = db.execute("SELECT * FROM sessions WHERE id = ?", (str(session_id),)).fetchone()
        return self._payload(updated)

    def _authorize(self, row: sqlite3.Row | None, token: str) -> None:
        if row is None or not hmac.compare_digest(row["token_hash"], self._hash(token)):
            raise SessionMissing
        if row["expires_at"] <= int(time.time()):
            raise SessionExpired
