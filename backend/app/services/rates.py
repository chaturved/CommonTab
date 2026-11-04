from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from fastapi import Depends

from app.core.errors import fail
from app.domain.currency import RATE_SCALE, fraction_digits
from app.integrations.rates import RateSource, RateUnavailable, get_rates


class RatesService:
    def __init__(self, source: RateSource = Depends(get_rates)):
        self.source = source

    def rate(self, base: str, quote: str) -> dict:
        if fraction_digits(base) is None or fraction_digits(quote) is None:
            fail(422, 'Currencies are three capital letters')
        if base == quote:
            fail(422, 'Pick two different currencies')
        try:
            rate, date = self.source.rate(base, quote)
        except RateUnavailable:
            fail(502, 'Exchange rates are not available right now', 'rates_unavailable')
        micros = int((rate * RATE_SCALE).to_integral_value(rounding=ROUND_HALF_UP))
        if micros < 1:
            fail(502, 'Exchange rates are not available right now', 'rates_unavailable')
        return {'base': base, 'quote': quote, 'rateMicros': micros, 'date': date}
