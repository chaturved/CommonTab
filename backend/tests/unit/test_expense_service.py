from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.schemas.groups import ExpenseInput
from app.services.access import MembershipGuard
from app.services.expenses import ExpenseService
from rows import NOW, expense_row, member_row


class TestExpenseService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.expenses = MagicMock(spec_set=ExpenseRepository)
        self.me = member_row(name='Ada')  # the signed-in member
        self.other = uuid4()
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.members.member_ids.return_value = {self.me.id, self.other}
        self.expenses.expense.return_value = None
        self.service = ExpenseService(self.expenses, self.members, self.groups, MembershipGuard(self.members))

    def expense_input(self, **changes) -> ExpenseInput:
        """A valid expense paid by the signed-in member and shared with one other member."""
        body = {'id': str(uuid4()), 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 1001,
                'payerID': str(self.me.id), 'method': 'equal', 'participants': [str(self.me.id), str(self.other)]}
        return ExpenseInput.model_validate({**body, **changes})

    def save(self, body):
        return self.service.save_expense(str(self.group_id), str(self.user_id), body)

    def delete(self, expense_id):
        self.service.delete_expense(str(self.group_id), str(expense_id), str(self.user_id))

    # --- saving
    def test_creates_the_expense_with_cents_split_between_participants(self):
        body = self.expense_input()
        self.expenses.expense.side_effect = [None, expense_row(id=body.id, version=1)]
        saved = self.save(body)
        values = self.expenses.insert_expense.call_args.args[0]
        assert [a['minorUnits'] for a in values['allocations']] == [501, 500]
        assert values['version'] == 1 and values['group_id'] == self.group_id
        self.groups.bump_version.assert_called_once_with(self.group_id)
        assert saved['version'] == 1

    def test_repeating_the_same_request_writes_nothing(self):
        body = self.expense_input()
        self.expenses.expense.side_effect = [None, expense_row(id=body.id)]
        self.save(body)
        inserted = self.expenses.insert_expense.call_args.args[0]
        stored = expense_row(**{k: v for k, v in inserted.items() if k != 'updated_at'}, group_id=self.group_id)
        self.expenses.expense.side_effect = None
        self.expenses.expense.return_value = stored
        self.groups.bump_version.reset_mock()

        again = self.save(body)

        assert again['id'] == str(body.id)
        self.expenses.insert_expense.assert_called_once()
        self.expenses.update_expense.assert_not_called()
        self.groups.bump_version.assert_not_called()

    def test_editing_with_a_stale_version_is_a_version_conflict(self):
        body = self.expense_input(merchant='Brunch', version=1)
        self.expenses.expense.return_value = expense_row(id=body.id, group_id=self.group_id, merchant='Lunch', version=2)
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert (caught.value.status, caught.value.code) == (409, 'version_conflict')
        assert caught.value.extra['current']['merchant'] == 'Lunch'
        self.expenses.update_expense.assert_not_called()

    def test_editing_with_the_current_version_updates_and_bumps_the_version(self):
        body = self.expense_input(merchant='Brunch', version=2)
        self.expenses.expense.return_value = expense_row(id=body.id, group_id=self.group_id, merchant='Lunch', version=2)
        self.save(body)
        values = self.expenses.update_expense.call_args.args[0]
        assert (values['merchant'], values['version']) == ('Brunch', 3)

    def test_an_expense_id_from_another_group_is_an_id_conflict(self):
        body = self.expense_input()
        self.expenses.expense.return_value = expense_row(id=body.id, group_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_an_outsider_gets_404_and_nothing_is_written(self):
        self.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            self.save(self.expense_input())
        assert caught.value.status == 404
        self.expenses.insert_expense.assert_not_called()

    def test_the_payer_must_belong_to_the_group(self):
        with pytest.raises(APIError) as caught:
            self.save(self.expense_input(payerID=str(uuid4())))
        assert caught.value.status == 422
        self.expenses.insert_expense.assert_not_called()

    def test_a_blank_description_is_rejected_before_anything_is_read(self):
        with pytest.raises(APIError) as caught:
            self.save(self.expense_input(merchant='   '))
        assert caught.value.status == 422
        self.members.member_of.assert_not_called()

    def test_a_timestamp_without_a_timezone_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.save(self.expense_input(occurredAt='2026-09-30T12:00:00'))
        assert caught.value.status == 422


    # --- restoring a deleted expense
    def test_restoring_with_the_tombstones_version_clears_deleted_at(self):
        body = self.expense_input(version=2)
        self.expenses.expense.return_value = expense_row(id=body.id, group_id=self.group_id, version=2,
                                                          deleted_at=NOW)
        self.save(body)
        values = self.expenses.update_expense.call_args.args[0]
        assert (values['version'], values['deleted_at']) == (3, None)

    def test_restoring_with_an_older_version_is_a_version_conflict(self):
        body = self.expense_input(version=1)
        self.expenses.expense.return_value = expense_row(id=body.id, group_id=self.group_id, version=2,
                                                          deleted_at=NOW)
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert caught.value.code == 'version_conflict'
        self.expenses.update_expense.assert_not_called()


    # --- deleting
    def test_deleting_leaves_a_tombstone_and_bumps_the_group(self):
        existing = expense_row(group_id=self.group_id)
        self.expenses.expense.return_value = existing
        self.delete(existing.id)
        assert self.expenses.tombstone_expense.call_args.args[0] == existing.id
        self.groups.bump_version.assert_called_once_with(self.group_id)

    def test_deleting_something_already_gone_is_a_no_op(self):
        self.expenses.expense.return_value = None
        self.delete(uuid4())
        self.expenses.tombstone_expense.assert_not_called()
        self.groups.bump_version.assert_not_called()

    def test_deleting_a_tombstone_is_a_no_op(self):
        existing = expense_row(group_id=self.group_id, deleted_at=NOW)
        self.expenses.expense.return_value = existing
        self.delete(existing.id)
        self.expenses.tombstone_expense.assert_not_called()

    def test_another_groups_expense_is_404(self):
        self.expenses.expense.return_value = expense_row(group_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.delete(uuid4())
        assert caught.value.status == 404
