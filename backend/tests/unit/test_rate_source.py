from decimal import Decimal
from unittest.mock import MagicMock

import httpx
import pytest

from app.integrations.rates import CachedRates, FrankfurterRates, RateSource, RateUnavailable


class TestFrankfurterRates:
    def source(self, handler) -> FrankfurterRates:
        return FrankfurterRates(httpx.Client(transport=httpx.MockTransport(handler)))

    def test_it_asks_for_the_pair_and_reads_the_rate_and_date(self):
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(str(request.url))
            return httpx.Response(200, json={'date': '2026-11-02', 'base': 'EUR', 'quote': 'USD', 'rate': 1.08})

        assert self.source(handler).rate('EUR', 'USD') == (Decimal('1.08'), '2026-11-02')
        assert seen == ['https://api.frankfurter.dev/v2/rate/EUR/USD']

    @pytest.mark.parametrize('response', [
        httpx.Response(500),
        httpx.Response(200, json={'date': 'd', 'base': 'EUR', 'quote': 'USD', 'rate': 0}),
        httpx.Response(200, json={'date': 'd', 'base': 'EUR', 'quote': 'GBP', 'rate': 0.9}),
        httpx.Response(200, json={'date': 'd'}),
        httpx.Response(200, text='not json'),
    ], ids=['server error', 'zero rate', 'wrong pair', 'missing fields', 'not json'])
    def test_a_bad_answer_is_unavailable(self, response):
        with pytest.raises(RateUnavailable):
            self.source(lambda request: response).rate('EUR', 'USD')

    def test_a_network_failure_is_unavailable(self):
        def handler(request):
            raise httpx.ConnectError('down')

        with pytest.raises(RateUnavailable):
            self.source(handler).rate('EUR', 'USD')


class TestCachedRates:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.source = MagicMock(spec_set=RateSource)
        self.source.rate.return_value = (Decimal('1.08'), '2026-11-02')
        self.now = 0.0
        self.cache = CachedRates(self.source, seconds=3600, clock=lambda: self.now)

    def test_a_pair_is_fetched_once_within_the_hour(self):
        self.cache.rate('EUR', 'USD')
        self.now = 3599
        self.cache.rate('EUR', 'USD')

        self.source.rate.assert_called_once_with('EUR', 'USD')

    def test_each_pair_has_its_own_entry(self):
        self.cache.rate('EUR', 'USD')
        self.cache.rate('USD', 'EUR')

        assert self.source.rate.call_count == 2

    def test_it_fetches_again_after_the_hour(self):
        self.cache.rate('EUR', 'USD')
        self.now = 3600
        self.source.rate.return_value = (Decimal('1.10'), '2026-11-03')

        assert self.cache.rate('EUR', 'USD') == (Decimal('1.10'), '2026-11-03')

    def test_an_old_rate_is_served_when_the_source_is_down(self):
        self.cache.rate('EUR', 'USD')
        self.now = 7200
        self.source.rate.side_effect = RateUnavailable('down')

        assert self.cache.rate('EUR', 'USD') == (Decimal('1.08'), '2026-11-02')

    def test_with_nothing_cached_a_failure_is_passed_on_and_not_remembered(self):
        self.source.rate.side_effect = RateUnavailable('down')
        with pytest.raises(RateUnavailable):
            self.cache.rate('EUR', 'USD')
        self.source.rate.side_effect = None

        assert self.cache.rate('EUR', 'USD')[1] == '2026-11-02'
