import pytest

from app.core.errors import APIError
from app.domain.rules import balances, format_utc, parse_utc


class TestBalances:
    def test_the_payer_is_owed_and_participants_owe(self):
        result = balances(['a', 'b'], [{'payerID': 'a', 'amountMinor': 1000, 'allocations': [
            {'memberID': 'a', 'minorUnits': 500}, {'memberID': 'b', 'minorUnits': 500}]}], [])
        assert result == [{'memberID': 'a', 'minorUnits': 500}, {'memberID': 'b', 'minorUnits': -500}]

    def test_a_settlement_moves_the_balance_back(self):
        expenses = [{'payerID': 'a', 'amountMinor': 1000, 'allocations': [
            {'memberID': 'a', 'minorUnits': 500}, {'memberID': 'b', 'minorUnits': 500}]}]
        result = balances(['a', 'b'], expenses, [{'fromID': 'b', 'toID': 'a', 'amountMinor': 500}])
        assert [item['minorUnits'] for item in result] == [0, 0]


class TestTimestamps:
    def test_parse_normalizes_to_utc(self):
        assert format_utc(parse_utc('2026-09-30T14:00:00+02:00')) == '2026-09-30T12:00:00Z'

    def test_a_timestamp_without_a_timezone_is_rejected(self):
        with pytest.raises(APIError) as caught:
            parse_utc('2026-09-30T12:00:00')
        assert caught.value.status == 422
