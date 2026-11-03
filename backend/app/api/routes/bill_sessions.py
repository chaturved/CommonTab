from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import BillSessionsDep, Token
from app.schemas.bill_sessions import CreateSession, CreatedSession, Session, UpdateSession

router = APIRouter(prefix='/v1')


@router.post('/sessions', response_model=CreatedSession, response_model_by_alias=True, status_code=201)
def create(request: CreateSession, store: BillSessionsDep) -> dict:
    return store.create(request.bill)


@router.get('/sessions/{session_id}', response_model=Session, response_model_by_alias=True)
def get(session_id: UUID, token: Token, store: BillSessionsDep) -> dict:
    return store.get(session_id, token)


@router.put('/sessions/{session_id}', response_model=Session, response_model_by_alias=True)
def update(session_id: UUID, request: UpdateSession, token: Token, store: BillSessionsDep) -> dict:
    return store.update(session_id, token, request.version, request.bill)
