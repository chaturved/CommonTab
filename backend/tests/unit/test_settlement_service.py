from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.settlements import SettlementRepository
from app.schemas.groups import SettlementInput
from app.services.access import MembershipGuard
from app.services.settlements import SettlementService
from app.services.snapshots import SnapshotBuilder
from rows import member_row, settlement_row


class TestSettlementService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        """Bob (the signed-in member) owes Ada 500."""
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.settlements = MagicMock(spec_set=SettlementRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        me = member_row(name='Bob')
        self.bob, self.ada = me.id, uuid4()
        self.group_id, self.user_id = me.group_id, me.user_id
        self.members.member_of.return_value = me
        self.snapshots.build.return_value = {'balances': [{'memberID': str(self.bob), 'minorUnits': -500},
                                                          {'memberID': str(self.ada), 'minorUnits': 500}]}
        self.settlements.settlement.return_value = None
        self.service = SettlementService(self.settlements, self.groups, MembershipGuard(self.members), self.snapshots)

    def payment(self, amount, frm=None, to=None, id=None) -> SettlementInput:
        return SettlementInput.model_validate({'id': str(id or uuid4()), 'fromID': str(frm or self.bob),
                                               'toID': str(to or self.ada), 'amountMinor': amount})

    def settle(self, body):
        return self.service.settle(str(self.group_id), str(self.user_id), body)

    def test_records_a_payment_up_to_the_balance(self):
        body = self.payment(500)
        self.settlements.settlement.side_effect = [None, settlement_row(id=body.id, amount_minor=500)]
        settlement, created = self.settle(body)
        assert created and settlement['amountMinor'] == 500
        self.settlements.insert_settlement.assert_called_once()
        assert self.settlements.insert_settlement.call_args.args[:5] == (body.id, self.group_id, self.bob, self.ada, 500)
        self.groups.bump_version.assert_called_once_with(self.group_id)

    def test_takes_the_group_lock_before_checking_balances(self):
        self.settlements.settlement.side_effect = [None, settlement_row()]
        self.settle(self.payment(100))
        self.groups.group.assert_called_once_with(self.group_id, lock=True)

    def test_repeating_the_same_payment_returns_it_without_a_second_write(self):
        body = self.payment(200)
        self.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=self.group_id, from_id=self.bob, to_id=self.ada, amount_minor=200)
        settlement, created = self.settle(body)
        assert not created and settlement['amountMinor'] == 200
        self.settlements.insert_settlement.assert_not_called()
        self.groups.bump_version.assert_not_called()

    def test_the_same_id_with_a_different_amount_is_an_id_conflict(self):
        body = self.payment(300)
        self.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=self.group_id, from_id=self.bob, to_id=self.ada, amount_minor=200)
        with pytest.raises(APIError) as caught:
            self.settle(body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_paying_more_than_is_owed_reports_the_maximum(self):
        with pytest.raises(APIError) as caught:
            self.settle(self.payment(501))
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 500
        self.settlements.insert_settlement.assert_not_called()

    def test_paying_in_the_wrong_direction_says_nothing_is_owed(self):
        with pytest.raises(APIError) as caught:
            self.settle(self.payment(100, frm=self.ada, to=self.bob))  # Ada owes Bob nothing
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 0

    def test_a_member_who_is_not_in_the_group_cannot_be_paid(self):
        with pytest.raises(APIError) as caught:
            self.settle(self.payment(100, to=uuid4()))
        assert caught.value.status == 422

    def test_only_a_participant_may_record_it(self):
        with pytest.raises(APIError) as caught:
            self.settle(self.payment(100, frm=uuid4(), to=self.ada))
        assert caught.value.status == 403
        self.snapshots.build.assert_not_called()
