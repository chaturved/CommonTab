from __future__ import annotations

import logging
import time
from decimal import Decimal
from functools import lru_cache
from typing import Callable, Protocol

import httpx

log = logging.getLogger(__name__)
FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rate'
CACHE_SECONDS = 3600


class RateUnavailable(Exception):
    pass


class RateSource(Protocol):
    def rate(self, base: str, quote: str) -> tuple[Decimal, str]: ...


class FrankfurterRates:
    def __init__(self, client: httpx.Client | None = None):
        self.client = client or httpx.Client(timeout=5.0)

    def rate(self, base: str, quote: str) -> tuple[Decimal, str]:
        try:
            response = self.client.get(f'{FRANKFURTER_URL}/{base}/{quote}')
            response.raise_for_status()
            body = response.json()
            rate = Decimal(str(body['rate']))
            valid = rate > 0 and body['base'].upper() == base and body['quote'].upper() == quote
            date = str(body['date'])
        except (httpx.HTTPError, ValueError, KeyError, TypeError, ArithmeticError) as problem:
            raise RateUnavailable(str(problem)) from problem
        if not valid:
            raise RateUnavailable('The rate source answered for a different pair')
        return rate, date


class CachedRates:
    def __init__(self, source: RateSource, seconds: int = CACHE_SECONDS, clock: Callable[[], float] = time.monotonic):
        self.source = source
        self.seconds = seconds
        self.clock = clock
        self.cached: dict[tuple[str, str], tuple[float, tuple[Decimal, str]]] = {}

    def rate(self, base: str, quote: str) -> tuple[Decimal, str]:
        key = (base, quote)
        hit = self.cached.get(key)
        if hit and self.clock() - hit[0] < self.seconds:
            return hit[1]
        try:
            fresh = self.source.rate(base, quote)
        except RateUnavailable:
            if hit:
                log.warning('Serving a stale %s/%s rate because the rate source failed', base, quote)
                return hit[1]
            raise
        self.cached[key] = (self.clock(), fresh)
        return fresh


@lru_cache
def get_rates() -> RateSource:
    return CachedRates(FrankfurterRates())
