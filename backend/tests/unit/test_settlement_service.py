from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.schemas.groups import SettlementInput
from app.services.settlements import SettlementService
from rows import settlement_row


@pytest.fixture
def service(repos) -> SettlementService:
    """Bob (the signed-in member) owes Ada 500."""
    repos.bob, repos.ada = repos.me.id, uuid4()
    repos.snapshots.build.return_value = {'balances': [{'memberID': str(repos.bob), 'minorUnits': -500},
                                                       {'memberID': str(repos.ada), 'minorUnits': 500}]}
    repos.settlements.settlement.return_value = None
    return SettlementService(repos.settlements, repos.groups, repos.guard, repos.snapshots)


def payment(repos, amount, frm=None, to=None, id=None) -> SettlementInput:
    return SettlementInput.model_validate({'id': str(id or uuid4()), 'fromID': str(frm or repos.bob),
                                           'toID': str(to or repos.ada), 'amountMinor': amount})


def settle(service, repos, body):
    return service.settle(str(repos.group_id), str(repos.user_id), body)


class TestSettle:
    def test_records_a_payment_up_to_the_balance(self, service, repos):
        body = payment(repos, 500)
        repos.settlements.settlement.side_effect = [None, settlement_row(id=body.id, amount_minor=500)]
        settlement, created = settle(service, repos, body)
        assert created and settlement['amountMinor'] == 500
        repos.settlements.insert_settlement.assert_called_once()
        assert repos.settlements.insert_settlement.call_args.args[:5] == (body.id, repos.group_id, repos.bob, repos.ada, 500)
        repos.groups.bump_version.assert_called_once_with(repos.group_id)

    def test_takes_the_group_lock_before_checking_balances(self, service, repos):
        repos.settlements.settlement.side_effect = [None, settlement_row()]
        settle(service, repos, payment(repos, 100))
        repos.groups.group.assert_called_once_with(repos.group_id, lock=True)

    def test_repeating_the_same_payment_returns_it_without_a_second_write(self, service, repos):
        body = payment(repos, 200)
        repos.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=repos.group_id, from_id=repos.bob, to_id=repos.ada, amount_minor=200)
        settlement, created = settle(service, repos, body)
        assert not created and settlement['amountMinor'] == 200
        repos.settlements.insert_settlement.assert_not_called()
        repos.groups.bump_version.assert_not_called()

    def test_the_same_id_with_a_different_amount_is_an_id_conflict(self, service, repos):
        body = payment(repos, 300)
        repos.settlements.settlement.return_value = settlement_row(
            id=body.id, group_id=repos.group_id, from_id=repos.bob, to_id=repos.ada, amount_minor=200)
        with pytest.raises(APIError) as caught:
            settle(service, repos, body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_paying_more_than_is_owed_reports_the_maximum(self, service, repos):
        with pytest.raises(APIError) as caught:
            settle(service, repos, payment(repos, 501))
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 500
        repos.settlements.insert_settlement.assert_not_called()

    def test_paying_in_the_wrong_direction_says_nothing_is_owed(self, service, repos):
        with pytest.raises(APIError) as caught:
            settle(service, repos, payment(repos, 100, frm=repos.ada, to=repos.bob))  # Ada owes Bob nothing
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 0

    def test_a_member_who_is_not_in_the_group_cannot_be_paid(self, service, repos):
        with pytest.raises(APIError) as caught:
            settle(service, repos, payment(repos, 100, to=uuid4()))
        assert caught.value.status == 422

    def test_only_a_participant_may_record_it(self, service, repos):
        with pytest.raises(APIError) as caught:
            settle(service, repos, payment(repos, 100, frm=uuid4(), to=repos.ada))
        assert caught.value.status == 403
        repos.snapshots.build.assert_not_called()
