from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import Row

from fastapi import Depends
from app.core.config import Settings, get_settings
from app.core.errors import fail
from app.repositories.bill_sessions import BillSessionRepository
from app.schemas.bill_sessions import Bill


class BillSessionService:
    def __init__(self, bill_sessions: BillSessionRepository = Depends(BillSessionRepository),
                 settings: Settings = Depends(get_settings)):
        self.bill_sessions = bill_sessions
        self.lifetime = timedelta(seconds=settings.bill_session_lifetime_seconds)

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def _payload(row: Row) -> dict:
        return {'id': str(row.id), 'version': row.version, 'expiresAt': row.expires_at.isoformat(), 'bill': row.bill}

    @staticmethod
    def _json(bill: Bill) -> dict:
        return json.loads(bill.model_dump_json(by_alias=True))

    def create(self, bill: Bill) -> dict:
        session_id = uuid4()
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expiry = now + self.lifetime
        self.bill_sessions.delete_expired(now)
        self.bill_sessions.insert(session_id, self._hash(token), self._json(bill), expiry)
        return {'id': session_id, 'accessToken': token, 'version': 1, 'expiresAt': expiry.isoformat(),
                'bill': bill.model_dump(mode='json', by_alias=True)}

    def get(self, session_id: UUID, token: str) -> dict:
        row = self.bill_sessions.get(session_id)
        self._authorize(row, token)
        return self._payload(row)

    def update(self, session_id: UUID, token: str, version: int, bill: Bill) -> dict:
        row = self.bill_sessions.get(session_id)
        self._authorize(row, token)
        if not self.bill_sessions.update(session_id, version, self._json(bill), datetime.now(timezone.utc)):
            fail(409, 'Session changed; reload before saving')
        return self._payload(self.bill_sessions.get(session_id))

    def _authorize(self, row: Row | None, token: str) -> None:
        if row is None or not hmac.compare_digest(row.token_hash, self._hash(token)):
            fail(404, 'Session not found')
        if row.expires_at <= datetime.now(timezone.utc):
            fail(410, 'Session expired')
