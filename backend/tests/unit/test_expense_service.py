from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.schemas.groups import ExpenseInput
from app.services.expenses import ExpenseService


def expense_input(world, **changes) -> ExpenseInput:
    body = {'id': str(uuid4()), 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 1001,
            'payerID': str(world.ada_member), 'method': 'equal',
            'participants': [str(world.ada_member), str(world.bob_member)]}
    return ExpenseInput.model_validate({**body, **changes})


@pytest.fixture
def service(world) -> ExpenseService:
    return ExpenseService(world.expenses, world.members, world.groups, world.guard)


class TestSaveExpense:
    def test_creates_the_expense_with_cents_split_between_participants(self, service, world):
        saved = service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world))
        assert saved['version'] == 1
        assert [a['minorUnits'] for a in saved['allocations']] == [501, 500]
        assert world.groups.rows[world.group_id].version == 2

    def test_repeating_the_same_request_changes_nothing(self, service, world):
        body = expense_input(world)
        service.save_expense(str(world.group_id), str(world.ada.id), body)
        again = service.save_expense(str(world.group_id), str(world.ada.id), body)
        assert again['version'] == 1
        assert world.groups.rows[world.group_id].version == 2

    def test_editing_with_a_stale_version_is_a_version_conflict(self, service, world):
        first = expense_input(world)
        service.save_expense(str(world.group_id), str(world.ada.id), first)
        service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, id=str(first.id), merchant='Lunch', version=1))
        with pytest.raises(APIError) as caught:
            service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, id=str(first.id), merchant='Brunch', version=1))
        assert (caught.value.status, caught.value.code) == (409, 'version_conflict')
        assert caught.value.extra['current']['merchant'] == 'Lunch'

    def test_an_outsider_gets_404(self, service, world):
        outsider = world.users.add('Eve', 'eve@example.com')
        with pytest.raises(APIError) as caught:
            service.save_expense(str(world.group_id), str(outsider.id), expense_input(world))
        assert caught.value.status == 404

    def test_the_payer_must_belong_to_the_group(self, service, world):
        with pytest.raises(APIError) as caught:
            service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, payerID=str(uuid4())))
        assert caught.value.status == 422

    def test_a_blank_description_is_rejected(self, service, world):
        with pytest.raises(APIError) as caught:
            service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, merchant='   '))
        assert caught.value.status == 422


class TestDeleteExpense:
    def test_deleting_keeps_a_tombstone_and_repeating_is_a_no_op(self, service, world):
        saved = service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world))
        service.delete_expense(str(world.group_id), saved['id'], str(world.bob.id))
        version = world.groups.rows[world.group_id].version
        service.delete_expense(str(world.group_id), saved['id'], str(world.bob.id))
        assert world.groups.rows[world.group_id].version == version
        assert [e.deleted_at is not None for e in world.expenses.rows.values()] == [True]

    def test_restoring_needs_the_tombstones_version(self, service, world):
        body = expense_input(world)
        saved = service.save_expense(str(world.group_id), str(world.ada.id), body)
        service.delete_expense(str(world.group_id), saved['id'], str(world.ada.id))
        with pytest.raises(APIError) as caught:
            service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, id=saved['id'], version=1))
        assert caught.value.code == 'version_conflict'
        restored = service.save_expense(str(world.group_id), str(world.ada.id), expense_input(world, id=saved['id'], version=2))
        assert restored['deletedAt'] is None
