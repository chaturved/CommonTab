from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from .models import CreateSession, CreatedSession, Session, UpdateSession
from .repository import SessionExpired, SessionMissing, BillSessionRepository, VersionConflict


def router_for(store: BillSessionRepository) -> APIRouter:
    router = APIRouter(prefix='/v1')

    def token(authorization: str | None) -> str:
        if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Bearer token required')
        return authorization[7:]

    def translate(error: Exception) -> HTTPException:
        if isinstance(error, SessionMissing):
            return HTTPException(404, 'Session not found')
        if isinstance(error, SessionExpired):
            return HTTPException(410, 'Session expired')
        if isinstance(error, VersionConflict):
            return HTTPException(409, 'Session changed; reload before saving')
        raise error

    @router.post('/sessions', response_model=CreatedSession, response_model_by_alias=True, status_code=201)
    def create(request: CreateSession) -> dict:
        return store.create(request.bill)

    @router.get('/sessions/{session_id}', response_model=Session, response_model_by_alias=True)
    def get(session_id: UUID, authorization: str | None = Header(default=None)) -> dict:
        try:
            return store.get(session_id, token(authorization))
        except (SessionMissing, SessionExpired) as error:
            raise translate(error) from error

    @router.put('/sessions/{session_id}', response_model=Session, response_model_by_alias=True)
    def update(session_id: UUID, request: UpdateSession, authorization: str | None = Header(default=None)) -> dict:
        try:
            return store.update(session_id, token(authorization), request.version, request.bill)
        except (SessionMissing, SessionExpired, VersionConflict) as error:
            raise translate(error) from error

    return router
