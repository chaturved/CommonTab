from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.schemas.groups import ExpenseInput
from app.services.expenses import ExpenseService
from rows import NOW, expense_row


def expense_input(repos, **changes) -> ExpenseInput:
    body = {'id': str(uuid4()), 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 1001,
            'payerID': str(repos.me.id), 'method': 'equal', 'participants': [str(repos.me.id), str(repos.other)]}
    return ExpenseInput.model_validate({**body, **changes})


@pytest.fixture
def service(repos) -> ExpenseService:
    repos.other = uuid4()
    repos.members.member_ids.return_value = {repos.me.id, repos.other}
    repos.expenses.expense.return_value = None
    return ExpenseService(repos.expenses, repos.members, repos.groups, repos.guard)


def save(service, repos, body):
    return service.save_expense(str(repos.group_id), str(repos.user_id), body)


class TestSaveExpense:
    def test_creates_the_expense_with_cents_split_between_participants(self, service, repos):
        body = expense_input(repos)
        repos.expenses.expense.side_effect = [None, expense_row(id=body.id, version=1)]
        saved = save(service, repos, body)
        values = repos.expenses.insert_expense.call_args.args[0]
        assert [a['minorUnits'] for a in values['allocations']] == [501, 500]
        assert values['version'] == 1 and values['group_id'] == repos.group_id
        repos.groups.bump_version.assert_called_once_with(repos.group_id)
        assert saved['version'] == 1

    def test_repeating_the_same_request_writes_nothing(self, service, repos):
        body = expense_input(repos)
        repos.expenses.expense.side_effect = [None, expense_row(id=body.id)]
        save(service, repos, body)
        inserted = repos.expenses.insert_expense.call_args.args[0]
        stored = expense_row(**{k: v for k, v in inserted.items() if k != 'updated_at'}, group_id=repos.group_id)
        repos.expenses.expense.side_effect = None
        repos.expenses.expense.return_value = stored
        repos.groups.bump_version.reset_mock()

        again = save(service, repos, body)

        assert again['id'] == str(body.id)
        repos.expenses.insert_expense.assert_called_once()
        repos.expenses.update_expense.assert_not_called()
        repos.groups.bump_version.assert_not_called()

    def test_editing_with_a_stale_version_is_a_version_conflict(self, service, repos):
        body = expense_input(repos, merchant='Brunch', version=1)
        repos.expenses.expense.return_value = expense_row(id=body.id, group_id=repos.group_id, merchant='Lunch', version=2)
        with pytest.raises(APIError) as caught:
            save(service, repos, body)
        assert (caught.value.status, caught.value.code) == (409, 'version_conflict')
        assert caught.value.extra['current']['merchant'] == 'Lunch'
        repos.expenses.update_expense.assert_not_called()

    def test_editing_with_the_current_version_updates_and_bumps_the_version(self, service, repos):
        body = expense_input(repos, merchant='Brunch', version=2)
        repos.expenses.expense.return_value = expense_row(id=body.id, group_id=repos.group_id, merchant='Lunch', version=2)
        save(service, repos, body)
        values = repos.expenses.update_expense.call_args.args[0]
        assert (values['merchant'], values['version']) == ('Brunch', 3)

    def test_an_expense_id_from_another_group_is_an_id_conflict(self, service, repos):
        body = expense_input(repos)
        repos.expenses.expense.return_value = expense_row(id=body.id, group_id=uuid4())
        with pytest.raises(APIError) as caught:
            save(service, repos, body)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_an_outsider_gets_404_and_nothing_is_written(self, service, repos):
        repos.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            save(service, repos, expense_input(repos))
        assert caught.value.status == 404
        repos.expenses.insert_expense.assert_not_called()

    def test_the_payer_must_belong_to_the_group(self, service, repos):
        with pytest.raises(APIError) as caught:
            save(service, repos, expense_input(repos, payerID=str(uuid4())))
        assert caught.value.status == 422
        repos.expenses.insert_expense.assert_not_called()

    def test_a_blank_description_is_rejected_before_anything_is_read(self, service, repos):
        with pytest.raises(APIError) as caught:
            save(service, repos, expense_input(repos, merchant='   '))
        assert caught.value.status == 422
        repos.members.member_of.assert_not_called()

    def test_a_timestamp_without_a_timezone_is_rejected(self, service, repos):
        with pytest.raises(APIError) as caught:
            save(service, repos, expense_input(repos, occurredAt='2026-09-30T12:00:00'))
        assert caught.value.status == 422


class TestRestoreDeletedExpense:
    def test_restoring_with_the_tombstones_version_clears_deleted_at(self, service, repos):
        body = expense_input(repos, version=2)
        repos.expenses.expense.return_value = expense_row(id=body.id, group_id=repos.group_id, version=2,
                                                          deleted_at=NOW)
        save(service, repos, body)
        values = repos.expenses.update_expense.call_args.args[0]
        assert (values['version'], values['deleted_at']) == (3, None)

    def test_restoring_with_an_older_version_is_a_version_conflict(self, service, repos):
        body = expense_input(repos, version=1)
        repos.expenses.expense.return_value = expense_row(id=body.id, group_id=repos.group_id, version=2,
                                                          deleted_at=NOW)
        with pytest.raises(APIError) as caught:
            save(service, repos, body)
        assert caught.value.code == 'version_conflict'
        repos.expenses.update_expense.assert_not_called()


class TestDeleteExpense:
    def delete(self, service, repos, expense_id):
        service.delete_expense(str(repos.group_id), str(expense_id), str(repos.user_id))

    def test_deleting_leaves_a_tombstone_and_bumps_the_group(self, service, repos):
        existing = expense_row(group_id=repos.group_id)
        repos.expenses.expense.return_value = existing
        self.delete(service, repos, existing.id)
        assert repos.expenses.tombstone_expense.call_args.args[0] == existing.id
        repos.groups.bump_version.assert_called_once_with(repos.group_id)

    def test_deleting_something_already_gone_is_a_no_op(self, service, repos):
        repos.expenses.expense.return_value = None
        self.delete(service, repos, uuid4())
        repos.expenses.tombstone_expense.assert_not_called()
        repos.groups.bump_version.assert_not_called()

    def test_deleting_a_tombstone_is_a_no_op(self, service, repos):
        existing = expense_row(group_id=repos.group_id, deleted_at=NOW)
        repos.expenses.expense.return_value = existing
        self.delete(service, repos, existing.id)
        repos.expenses.tombstone_expense.assert_not_called()

    def test_another_groups_expense_is_404(self, service, repos):
        repos.expenses.expense.return_value = expense_row(group_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.delete(service, repos, uuid4())
        assert caught.value.status == 404
