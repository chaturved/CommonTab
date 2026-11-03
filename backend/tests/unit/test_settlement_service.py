from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.schemas.groups import SettlementInput
from app.services.expenses import ExpenseService
from app.services.settlements import SettlementService
from test_expense_service import expense_input


def payment(world, amount, frm=None, to=None, id=None) -> SettlementInput:
    return SettlementInput.model_validate({
        'id': str(id or uuid4()), 'fromID': str(frm or world.bob_member), 'toID': str(to or world.ada_member),
        'amountMinor': amount})


@pytest.fixture
def service(world) -> SettlementService:
    # Ada paid 1000 split evenly: Bob owes Ada 500.
    ExpenseService(world.expenses, world.members, world.groups, world.guard).save_expense(
        str(world.group_id), str(world.ada.id), expense_input(world, amountMinor=1000))
    return SettlementService(world.settlements, world.groups, world.guard, world.snapshots)


class TestSettle:
    def test_records_a_payment_up_to_the_balance(self, service, world):
        settlement, created = service.settle(str(world.group_id), str(world.bob.id), payment(world, 500))
        assert created and settlement['amountMinor'] == 500

    def test_repeating_the_same_payment_returns_it_without_creating_another(self, service, world):
        body = payment(world, 200)
        service.settle(str(world.group_id), str(world.bob.id), body)
        again, created = service.settle(str(world.group_id), str(world.bob.id), body)
        assert not created and again['amountMinor'] == 200
        assert len(world.settlements.rows) == 1

    def test_the_same_id_with_a_different_amount_is_an_id_conflict(self, service, world):
        body = payment(world, 200)
        service.settle(str(world.group_id), str(world.bob.id), body)
        with pytest.raises(APIError) as caught:
            service.settle(str(world.group_id), str(world.bob.id), payment(world, 300, id=body.id))
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_paying_more_than_is_owed_reports_the_maximum(self, service, world):
        with pytest.raises(APIError) as caught:
            service.settle(str(world.group_id), str(world.bob.id), payment(world, 501))
        assert caught.value.status == 422 and caught.value.extra['maxAmountMinor'] == 500

    def test_paying_in_the_wrong_direction_is_rejected(self, service, world):
        with pytest.raises(APIError) as caught:
            service.settle(str(world.group_id), str(world.ada.id), payment(world, 100, frm=world.ada_member, to=world.bob_member))
        assert caught.value.status == 422

    def test_only_a_participant_may_record_it(self, service, world):
        third = world.users.add('Cy', 'cy@example.com')
        world.members.insert_member(uuid4(), world.group_id, third.id, 'Cy', None)
        with pytest.raises(APIError) as caught:
            service.settle(str(world.group_id), str(third.id), payment(world, 100))
        assert caught.value.status == 403
