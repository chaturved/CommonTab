from unittest.mock import MagicMock

import pytest

from app.services.rates import RatesService


class TestRatesRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=RatesService)
        self.service.rate.return_value = {'base': 'EUR', 'quote': 'USD', 'rateMicros': 1_080_000, 'date': '2026-11-02'}
        overrides[RatesService] = lambda: self.service

    def test_it_passes_the_pair_and_returns_the_rate(self):
        response = self.client.get('/v1/rates?base=EUR&quote=USD')

        assert (response.status_code, response.json()['rateMicros']) == (200, 1_080_000)
        self.service.rate.assert_called_once_with('EUR', 'USD')

    @pytest.mark.parametrize('query', ['base=EUR', 'quote=USD', 'base=EU&quote=USD', 'base=EURO&quote=USD'])
    def test_a_missing_or_malformed_currency_is_422(self, query):
        assert self.client.get(f'/v1/rates?{query}').status_code == 422
