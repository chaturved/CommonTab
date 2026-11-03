from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.services.expenses import ExpenseService
from mocks import make_repos
from rows import NOW, expense_input, expense_row


class TestExpenseService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.repos = make_repos()
        self.repos.other = uuid4()
        self.repos.members.member_ids.return_value = {self.repos.me.id, self.repos.other}
        self.repos.expenses.expense.return_value = None
        self.service = ExpenseService(self.repos.expenses, self.repos.members, self.repos.groups, self.repos.guard)

    def save(self, body):
        return self.service.save_expense(str(self.repos.group_id), str(self.repos.user_id), body)

    def delete(self, expense_id):
        self.service.delete_expense(str(self.repos.group_id), str(expense_id), str(self.repos.user_id))

    # --- saving
    def test_creates_the_expense_with_cents_split_between_participants(self):
        body = expense_input(self.repos)
        self.repos.expenses.expense.side_effect = [None, expense_row(id=body.id, version=1)]
        saved = self.save(body)
        values = self.repos.expenses.insert_expense.call_args.args[0]
        assert [a['minorUnits'] for a in values['allocations']] == [501, 500]
        assert values['version'] == 1 and values['group_id'] == self.repos.group_id
        self.repos.groups.bump_version.assert_called_once_with(self.repos.group_id)
        assert saved['version'] == 1

    def test_repeating_the_same_request_writes_nothing(self):
        body = expense_input(self.repos)
        self.repos.expenses.expense.side_effect = [None, expense_row(id=body.id)]
        self.save(body)
        inserted = self.repos.expenses.insert_expense.call_args.args[0]
        stored = expense_row(**{k: v for k, v in inserted.items() if k != 'updated_at'}, group_id=self.repos.group_id)
        self.repos.expenses.expense.side_effect = None
        self.repos.expenses.expense.return_value = stored
        self.repos.groups.bump_version.reset_mock()

        again = self.save(body)

        assert again['id'] == str(body.id)
        self.repos.expenses.insert_expense.assert_called_once()
        self.repos.expenses.update_expense.assert_not_called()
        self.repos.groups.bump_version.assert_not_called()

    def test_editing_with_a_stale_version_is_a_version_conflict(self):
        body = expense_input(self.repos, merchant='Brunch', version=1)
        self.repos.expenses.expense.return_value = expense_row(id=body.id, group_id=self.repos.group_id, merchant='Lunch', version=2)
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert (caught.value.status, caught.value.code) == (409, 'version_conflict')
        assert caught.value.extra['current']['merchant'] == 'Lunch'
        self.repos.expenses.update_expense.assert_not_called()

    def test_editing_with_the_current_version_updates_and_bumps_the_version(self):
        body = expense_input(self.repos, merchant='Brunch', version=2)
        self.repos.expenses.expense.return_value = expense_row(id=body.id, group_id=self.repos.group_id, merchant='Lunch', version=2)
        self.save(body)
        values = self.repos.expenses.update_expense.call_args.args[0]
        assert (values['merchant'], values['version']) == ('Brunch', 3)

    def test_an_expense_id_from_another_group_is_an_id_conflict(self):
        body = expense_input(self.repos)
        self.repos.expenses.expense.return_value = expense_row(id=body.id, group_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_an_outsider_gets_404_and_nothing_is_written(self):
        self.repos.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            self.save(expense_input(self.repos))
        assert caught.value.status == 404
        self.repos.expenses.insert_expense.assert_not_called()

    def test_the_payer_must_belong_to_the_group(self):
        with pytest.raises(APIError) as caught:
            self.save(expense_input(self.repos, payerID=str(uuid4())))
        assert caught.value.status == 422
        self.repos.expenses.insert_expense.assert_not_called()

    def test_a_blank_description_is_rejected_before_anything_is_read(self):
        with pytest.raises(APIError) as caught:
            self.save(expense_input(self.repos, merchant='   '))
        assert caught.value.status == 422
        self.repos.members.member_of.assert_not_called()

    def test_a_timestamp_without_a_timezone_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.save(expense_input(self.repos, occurredAt='2026-09-30T12:00:00'))
        assert caught.value.status == 422


    # --- restoring a deleted expense
    def test_restoring_with_the_tombstones_version_clears_deleted_at(self):
        body = expense_input(self.repos, version=2)
        self.repos.expenses.expense.return_value = expense_row(id=body.id, group_id=self.repos.group_id, version=2,
                                                          deleted_at=NOW)
        self.save(body)
        values = self.repos.expenses.update_expense.call_args.args[0]
        assert (values['version'], values['deleted_at']) == (3, None)

    def test_restoring_with_an_older_version_is_a_version_conflict(self):
        body = expense_input(self.repos, version=1)
        self.repos.expenses.expense.return_value = expense_row(id=body.id, group_id=self.repos.group_id, version=2,
                                                          deleted_at=NOW)
        with pytest.raises(APIError) as caught:
            self.save(body)
        assert caught.value.code == 'version_conflict'
        self.repos.expenses.update_expense.assert_not_called()


    # --- deleting
    def test_deleting_leaves_a_tombstone_and_bumps_the_group(self):
        existing = expense_row(group_id=self.repos.group_id)
        self.repos.expenses.expense.return_value = existing
        self.delete(existing.id)
        assert self.repos.expenses.tombstone_expense.call_args.args[0] == existing.id
        self.repos.groups.bump_version.assert_called_once_with(self.repos.group_id)

    def test_deleting_something_already_gone_is_a_no_op(self):
        self.repos.expenses.expense.return_value = None
        self.delete(uuid4())
        self.repos.expenses.tombstone_expense.assert_not_called()
        self.repos.groups.bump_version.assert_not_called()

    def test_deleting_a_tombstone_is_a_no_op(self):
        existing = expense_row(group_id=self.repos.group_id, deleted_at=NOW)
        self.repos.expenses.expense.return_value = existing
        self.delete(existing.id)
        self.repos.expenses.tombstone_expense.assert_not_called()

    def test_another_groups_expense_is_404(self):
        self.repos.expenses.expense.return_value = expense_row(group_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.delete(uuid4())
        assert caught.value.status == 404
