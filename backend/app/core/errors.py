from __future__ import annotations


class APIError(Exception):
    def __init__(self, status: int, message: str, code: str | None = None, extra: dict | None = None,
                 headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.extra = extra or {}
        self.headers = headers

    def body(self) -> dict:
        body: dict = {'detail': self.message}
        if self.code:
            body['code'] = self.code
        return {**body, **self.extra}


def fail(status: int, message: str, code: str | None = None, **extra):
    raise APIError(status, message, code, extra)
