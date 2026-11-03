from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.errors import APIError


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    def api_error_handler(_request: Request, error: APIError):
        return JSONResponse(status_code=error.status, content=error.body())
