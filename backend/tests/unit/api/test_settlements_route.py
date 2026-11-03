from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.settlements import SettlementService
from conftest import USER_ID

GROUP = str(uuid4())


def payment(**changes) -> dict:
    return {'id': str(uuid4()), 'fromID': str(uuid4()), 'toID': str(uuid4()), 'amountMinor': 500, **changes}


class TestSettlementsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=SettlementService)
        overrides[SettlementService] = lambda: self.service

    def test_a_new_payment_is_201(self):
        self.service.settle.return_value = ({'amountMinor': 500}, True)

        response = self.client.post(f'/v1/groups/{GROUP}/settlements', json=payment())

        assert (response.status_code, response.json()) == (201, {'amountMinor': 500})
        assert self.service.settle.call_args.args[:2] == (GROUP, USER_ID)

    def test_repeating_a_payment_is_200(self):
        self.service.settle.return_value = ({'amountMinor': 500}, False)

        assert self.client.post(f'/v1/groups/{GROUP}/settlements', json=payment()).status_code == 200

    @pytest.mark.parametrize('changes', [{'amountMinor': 0}, {'amountMinor': -5}, {'fromID': 'x'}])
    def test_an_invalid_payment_is_422(self, changes):
        assert self.client.post(f'/v1/groups/{GROUP}/settlements', json=payment(**changes)).status_code == 422
        self.service.settle.assert_not_called()

    def test_the_old_group_version_field_is_accepted_and_ignored(self):
        self.service.settle.return_value = ({}, True)

        assert self.client.post(f'/v1/groups/{GROUP}/settlements', json=payment(groupVersion=7)).status_code == 201
