from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import Row

from app.repositories.unit_of_work import UnitOfWorkFactory
from app.schemas.bill_sessions import Bill


class SessionMissing(Exception):
    pass


class SessionExpired(Exception):
    pass


class VersionConflict(Exception):
    pass


class BillSessionService:
    def __init__(self, uow: UnitOfWorkFactory, lifetime_seconds: int = 7 * 24 * 60 * 60):
        self.uow = uow
        self.lifetime = timedelta(seconds=lifetime_seconds)

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def _payload(row: Row) -> dict:
        return {'id': str(row.id), 'version': row.version, 'expiresAt': row.expires_at.isoformat(), 'bill': row.bill}

    @staticmethod
    def _json(bill: Bill) -> dict:
        # Decimals travel as strings, exactly as the client sent them.
        return json.loads(bill.model_dump_json(by_alias=True))

    def create(self, bill: Bill) -> dict:
        session_id = uuid4()
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expiry = now + self.lifetime
        with self.uow() as uow:
            uow.bill_sessions.delete_expired(now)
            uow.bill_sessions.insert(session_id, self._hash(token), self._json(bill), expiry)
        return {'id': session_id, 'accessToken': token, 'version': 1, 'expiresAt': expiry.isoformat(),
                'bill': bill.model_dump(mode='json', by_alias=True)}

    def get(self, session_id: UUID, token: str) -> dict:
        with self.uow() as uow:
            row = uow.bill_sessions.get(session_id)
        self._authorize(row, token)
        return self._payload(row)

    def update(self, session_id: UUID, token: str, version: int, bill: Bill) -> dict:
        with self.uow() as uow:
            row = uow.bill_sessions.get(session_id)
            self._authorize(row, token)
            if not uow.bill_sessions.update(session_id, version, self._json(bill), datetime.now(timezone.utc)):
                raise VersionConflict
            return self._payload(uow.bill_sessions.get(session_id))

    def _authorize(self, row: Row | None, token: str) -> None:
        if row is None or not hmac.compare_digest(row.token_hash, self._hash(token)):
            raise SessionMissing
        if row.expires_at <= datetime.now(timezone.utc):
            raise SessionExpired
