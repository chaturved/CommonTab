"""Run the shared money fixtures (fixtures/money) against the server's split rules.

The TypeScript core runs the same files, so the app and the server cannot disagree on a cent.
"""
import json
from pathlib import Path

import pytest

from app.core.errors import APIError
from app.domain.rules import allocation

FIXTURES = Path(__file__).resolve().parents[2] / 'fixtures' / 'money'


def cases():
    return [
        pytest.param(case, id=f"{file}: {case['name']}")
        for file in ('equal.json', 'exact.json', 'percent.json')
        for case in json.loads((FIXTURES / file).read_text())
    ]


@pytest.mark.parametrize('case', cases())
def test_split_fixtures(case):
    data = case['input']
    args = (data['amount'], data['method'], data['participants'], data['values'])
    if case.get('error'):
        with pytest.raises(APIError) as caught:
            allocation(*args)
        assert caught.value.status == 422
    else:
        result = allocation(*args)
        assert result == case['expect']
        assert sum(item['minorUnits'] for item in result) == data['amount']
