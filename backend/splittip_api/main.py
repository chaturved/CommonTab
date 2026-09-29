from __future__ import annotations

import os
import secrets
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, status

from .models import CreateSession, CreatedSession, ProductEvent, Session, UpdateSession
from .storage import SessionExpired, SessionMissing, SessionStore, VersionConflict


def create_app(database_path: Path | None = None, lifetime_seconds: int = 7 * 24 * 60 * 60) -> FastAPI:
    path = database_path or Path(os.environ.get(
        "SPLITTIP_DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "splittip.sqlite3")
    ))
    store = SessionStore(path, lifetime_seconds=lifetime_seconds)
    app = FastAPI(title="SplitTip API", version="0.1.0")

    def token_from_header(authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token required")
        token = authorization.removeprefix("Bearer ")
        if not token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token required")
        return token

    def translate_error(error: Exception) -> HTTPException:
        if isinstance(error, SessionMissing):
            return HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        if isinstance(error, SessionExpired):
            return HTTPException(status.HTTP_410_GONE, "Session expired")
        if isinstance(error, VersionConflict):
            return HTTPException(status.HTTP_409_CONFLICT, "Session changed; reload before saving")
        raise error

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/v1/events", status_code=202)
    def record_event(event: ProductEvent) -> dict[str, str]:
        store.record_event(event.name, event.variant)
        return {"status": "accepted"}

    @app.get("/v1/metrics")
    def metrics(authorization: str | None = Header(default=None)) -> dict:
        admin_token = os.environ.get("SPLITTIP_METRICS_TOKEN")
        if not admin_token:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Metrics access is not configured")
        if not secrets.compare_digest(token_from_header(authorization), admin_token):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid metrics token")
        return {"counts": store.event_counts()}

    @app.post("/v1/sessions", response_model=CreatedSession, response_model_by_alias=True, status_code=201)
    def create_session(request: CreateSession) -> dict:
        return store.create(request.bill)

    @app.get("/v1/sessions/{session_id}", response_model=Session, response_model_by_alias=True)
    def get_session(session_id: UUID, authorization: str | None = Header(default=None)) -> dict:
        try:
            return store.get(session_id, token_from_header(authorization))
        except (SessionMissing, SessionExpired) as error:
            raise translate_error(error) from error

    @app.put("/v1/sessions/{session_id}", response_model=Session, response_model_by_alias=True)
    def update_session(
        session_id: UUID,
        request: UpdateSession,
        authorization: str | None = Header(default=None),
    ) -> dict:
        try:
            return store.update(session_id, token_from_header(authorization), request.version, request.bill)
        except (SessionMissing, SessionExpired, VersionConflict) as error:
            raise translate_error(error) from error

    return app


app = create_app()
