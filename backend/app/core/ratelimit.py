from __future__ import annotations

import hashlib
import time
from collections import deque
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import Settings

AUTH_PATHS = {'/v1/accounts', '/v1/auth/sessions'}
EXEMPT_PATHS = {'/healthz', '/health'}


class SlidingWindow:
    """Allow `limit` hits per `window` seconds for each key. In memory: right for one API instance."""

    def __init__(self, limit: int, window: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window
        self.clock = clock
        self.hits: dict[str, deque[float]] = {}
        self.calls = 0

    def check(self, key: str) -> float:
        """Returns 0 when the request is allowed, otherwise the seconds to wait before retrying."""
        now = self.clock()
        self.calls += 1
        if self.calls % 1000 == 0:  # forget keys that have gone quiet
            self.hits = {k: q for k, q in self.hits.items() if q and q[-1] > now - self.window}
        queue = self.hits.setdefault(key, deque())
        while queue and queue[0] <= now - self.window:
            queue.popleft()
        if len(queue) >= self.limit:
            return max(0.001, queue[0] + self.window - now)
        queue.append(now)
        return 0.0


def client_ip(request: Request, trust_proxy: bool) -> str:
    if trust_proxy:
        forwarded = request.headers.get('x-forwarded-for', '')
        if forwarded.strip():
            return forwarded.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'


def install_rate_limits(app: FastAPI, settings: Settings, clock: Callable[[], float] = time.monotonic) -> None:
    """
    Sign-up and sign-in are limited per IP (password guessing). Everything else is limited per
    signed-in session, so people sharing a mobile-carrier IP do not block each other. The limits
    leave room for a device flushing a queue of offline changes.
    """
    auth = SlidingWindow(settings.rate_limit_auth_per_minute, clock=clock)
    api = SlidingWindow(settings.rate_limit_per_minute, clock=clock)

    @app.middleware('http')
    async def rate_limit(request: Request, call_next):
        path = request.url.path
        if path in EXEMPT_PATHS or request.method == 'OPTIONS':
            return await call_next(request)
        ip = client_ip(request, settings.trust_proxy)
        if path in AUTH_PATHS and request.method == 'POST':
            wait = auth.check(f'ip:{ip}')
        else:
            bearer = request.headers.get('authorization', '')
            key = 'token:' + hashlib.sha256(bearer.encode()).hexdigest()[:16] if bearer.startswith('Bearer ') else f'ip:{ip}'
            wait = api.check(key)
        if wait:
            return JSONResponse(status_code=429, headers={'Retry-After': str(int(wait) + 1)},
                                content={'detail': 'Too many requests. Try again shortly.', 'code': 'rate_limited',
                                         'retryAfterSeconds': int(wait) + 1})
        return await call_next(request)
