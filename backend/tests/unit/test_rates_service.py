from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.core.errors import APIError
from app.integrations.rates import RateSource, RateUnavailable
from app.services.rates import RatesService


class TestRatesService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.source = MagicMock(spec_set=RateSource)
        self.source.rate.return_value = (Decimal('1.08'), '2026-11-02')
        self.service = RatesService(self.source)

    def test_the_rate_is_returned_in_millionths_with_its_date(self):
        assert self.service.rate('EUR', 'USD') == {'base': 'EUR', 'quote': 'USD', 'rateMicros': 1_080_000, 'date': '2026-11-02'}

    def test_a_long_rate_is_rounded_half_up_to_a_millionth(self):
        self.source.rate.return_value = (Decimal('0.0067005'), 'd')

        assert self.service.rate('JPY', 'USD')['rateMicros'] == 6701

    @pytest.mark.parametrize('base, quote', [('eur', 'USD'), ('EU', 'USD'), ('EUR', 'US1'), ('USD', 'USD')])
    def test_a_bad_pair_is_422_and_the_source_is_not_asked(self, base, quote):
        with pytest.raises(APIError) as caught:
            self.service.rate(base, quote)

        assert caught.value.status == 422
        self.source.rate.assert_not_called()

    def test_an_unavailable_source_is_502(self):
        self.source.rate.side_effect = RateUnavailable('down')

        with pytest.raises(APIError) as caught:
            self.service.rate('EUR', 'USD')

        assert (caught.value.status, caught.value.code) == (502, 'rates_unavailable')

    def test_a_rate_that_rounds_to_nothing_is_502(self):
        self.source.rate.return_value = (Decimal('0.0000001'), 'd')

        with pytest.raises(APIError) as caught:
            self.service.rate('VND', 'KWD')

        assert caught.value.status == 502
