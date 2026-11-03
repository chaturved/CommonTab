from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.services.settlements import SettlementService
from mocks import make_repos
from rows import payment, settlement_row


class TestSettlementService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        """Bob (the signed-in member) owes Ada 500."""
        self.repos = make_repos()
        self.repos.bob, self.repos.ada = self.repos.me.id, uuid4()
        self.repos.snapshots.build.return_value = {'balances': [
            {'memberID': str(self.repos.bob), 'minorUnits': -500},
            {'memberID': str(self.repos.ada), 'minorUnits': 500}]}
        self.repos.settlements.settlement.return_value = None
        self.service = SettlementService(self.repos.settlements, self.repos.groups, self.repos.guard,
                                         self.repos.snapshots)

    def settle(self, body):
        return self.service.settle(str(self.repos.group_id), str(self.repos.user_id), body)

    def test_records_a_payment_up_to_the_balance(self):
        body = payment(self.repos, 500)
        self.repos.settlements.settlement.side_effect = [None, settlement_row(id=body.id, amount_minor=500)]
        settlement, created = self.settle(body)
        assert created and settlement['amountMinor'] == 500
        self.repos.settlements.insert_settlement.assert_called_once()
        assert self.repos.settlements.insert_settlement.call_args.args[:5] == (body.id, self.repos.group_id, self.repos.bob, self.repos.ada, 500)
        self.repos.groups.bump_version.assert_called_once_with(self.repos.group_id)

    def test_takes_the_group_lock_before_checking_balances(self):
        self.repos.settlements.settlement.side_effect = [None, settlement_row()]
        self.settle(payment(self.repos, 100))
        self.repos.groups.group.assert_called_once_with(self.repos.group_id, lock=True)

    def test_repeating_the_same_payment_returns_it_without_a_second_write(self):
        body = payment(self.repos, 200)
        self.repos.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=self.repos.group_id, from_id=self.repos.bob, to_id=self.repos.ada, amount_minor=200)
        settlement, created = self.settle(body)
        assert not created and settlement['amountMinor'] == 200
        self.repos.settlements.insert_settlement.assert_not_called()
        self.repos.groups.bump_version.assert_not_called()

    def test_the_same_id_with_a_different_amount_is_an_id_conflict(self):
        body = payment(self.repos, 300)
        self.repos.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=self.repos.group_id, from_id=self.repos.bob, to_id=self.repos.ada, amount_minor=200)
        with pytest.raises(APIError) as caught:
            self.settle(body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_paying_more_than_is_owed_reports_the_maximum(self):
        with pytest.raises(APIError) as caught:
            self.settle(payment(self.repos, 501))
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 500
        self.repos.settlements.insert_settlement.assert_not_called()

    def test_paying_in_the_wrong_direction_says_nothing_is_owed(self):
        with pytest.raises(APIError) as caught:
            self.settle(payment(self.repos, 100, frm=self.repos.ada, to=self.repos.bob))  # Ada owes Bob nothing
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 0

    def test_a_member_who_is_not_in_the_group_cannot_be_paid(self):
        with pytest.raises(APIError) as caught:
            self.settle(payment(self.repos, 100, to=uuid4()))
        assert caught.value.status == 422

    def test_only_a_participant_may_record_it(self):
        with pytest.raises(APIError) as caught:
            self.settle(payment(self.repos, 100, frm=uuid4(), to=self.repos.ada))
        assert caught.value.status == 403
        self.repos.snapshots.build.assert_not_called()
