from __future__ import annotations

import hashlib
import time
from collections import deque
from functools import lru_cache
from typing import Callable

from fastapi import Request

from app.core.config import SESSION_COOKIE, Settings, get_settings

AUTH_PATHS = {'/v1/accounts', '/v1/auth/sessions', '/v1/invitations/join', '/v1/auth/password-reset',
              '/v1/auth/password-reset/confirm', '/v1/me/password', '/v1/me/delete'}
EXEMPT_PATHS = {'/healthz', '/health'}


class SlidingWindow:
    def __init__(self, limit: int, window: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window
        self.clock = clock
        self.hits: dict[str, deque[float]] = {}
        self.calls = 0

    def check(self, key: str) -> float:
        now = self.clock()
        self.calls += 1
        if self.calls % 1000 == 0:
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


class RateLimiters:
    def __init__(self, settings: Settings, clock: Callable[[], float] = time.monotonic):
        self.trust_proxy = settings.trust_proxy
        self.auth = SlidingWindow(settings.rate_limit_auth_per_minute, clock=clock)
        self.api = SlidingWindow(settings.rate_limit_per_minute, clock=clock)

    def check(self, request: Request) -> float:
        path = request.url.path
        if path in EXEMPT_PATHS or request.method == 'OPTIONS':
            return 0.0
        ip = client_ip(request, self.trust_proxy)
        if path in AUTH_PATHS and request.method == 'POST':
            return self.auth.check(f'ip:{ip}')
        credential = request.headers.get('authorization', '') or request.cookies.get(SESSION_COOKIE, '')
        key = 'token:' + hashlib.sha256(credential.encode()).hexdigest()[:16] if credential else f'ip:{ip}'
        return self.api.check(key)


@lru_cache
def get_rate_limiters() -> RateLimiters:
    return RateLimiters(get_settings())
