import json
from pathlib import Path

import pytest

from app.domain.currency import convert_minor, fraction_digits

FIXTURES = Path(__file__).resolve().parents[3] / 'fixtures' / 'money'


def cases():
    return [pytest.param(case, id=case['name']) for case in json.loads((FIXTURES / 'convert.json').read_text())]


class TestCurrencyConversion:
    @pytest.mark.parametrize('case', cases())
    def test_conversion_fixtures(self, case):
        data = case['input']
        args = (data['original'], data['from'], data['to'], data['rateMicros'])
        if case.get('error'):
            with pytest.raises(ValueError):
                convert_minor(*args)
        else:
            assert convert_minor(*args) == case['expect']

    @pytest.mark.parametrize('code, digits', [('USD', 2), ('JPY', 0), ('KWD', 3), ('usd', None), ('US', None)])
    def test_fraction_digits(self, code, digits):
        assert fraction_digits(code) == digits

    def test_an_unknown_currency_is_refused(self):
        with pytest.raises(ValueError):
            convert_minor(100, 'usd', 'EUR', 1_000_000)
