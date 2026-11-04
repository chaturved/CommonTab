from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.activity import ActivityRepository
from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.schemas.groups import ExpenseInput
from app.services.access import MembershipGuard
from app.services.expenses import ExpenseService
from rows import NOW, expense_row, group_row, member_row


class TestExpenseService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.expenses = MagicMock(spec_set=ExpenseRepository)
        self.me = member_row(name='Ada')
        self.other = uuid4()
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.members.member_ids.return_value = {self.me.id, self.other}
        self.expenses.expense.return_value = None
        self.activity = MagicMock(spec_set=ActivityRepository)
        self.service = ExpenseService(self.expenses, self.members, self.groups, MembershipGuard(self.members), self.activity)

    def expense_input(self, **changes) -> ExpenseInput:
        body = {'id': str(uuid4()), 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 1001,
                'payerID': str(self.me.id), 'method': 'equal', 'participants': [str(self.me.id), str(self.other)]}
        return ExpenseInput.model_validate({**body, **changes})

    def save(self, body):
        return self.service.save_expense(str(self.group_id), str(self.user_id), body)

    def delete(self, expense_id):
        self.service.delete_expense(str(self.group_id), str(expense_id), str(self.user_id))

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
        stored = expense_row(**{k: v for k, v in inserted.items() if k != 'updated_at'})
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


class TestExpenseActivity:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.expenses = MagicMock(spec_set=ExpenseRepository)
        self.activity = MagicMock(spec_set=ActivityRepository)
        self.me = member_row(name='Ada')
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.members.member_ids.return_value = {self.me.id}
        self.service = ExpenseService(self.expenses, self.members, self.groups, MembershipGuard(self.members), self.activity)

    def body(self, **changes) -> ExpenseInput:
        base = {'id': str(uuid4()), 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 16000,
                'payerID': str(self.me.id), 'method': 'equal', 'participants': [str(self.me.id)]}
        return ExpenseInput.model_validate({**base, **changes})

    def save(self, body):
        return self.service.save_expense(str(self.group_id), str(self.user_id), body)

    def logged(self):
        return [(c.args[1], c.args[2], c.args[4]) for c in self.activity.record.call_args_list]

    def test_a_new_expense_is_logged_as_added_by_you_with_its_description_and_amount(self):
        body = self.body()
        self.expenses.expense.side_effect = [None, expense_row(id=body.id)]

        self.save(body)

        assert self.logged() == [(self.me.id, 'expense.added', {'merchant': 'Dinner', 'amountMinor': 16000})]
        assert self.activity.record.call_args.args[3] == body.id

    def test_changing_the_amount_is_logged_as_an_edit_with_the_old_amount(self):
        body = self.body(amountMinor=16350, version=1)
        self.expenses.expense.side_effect = [
            expense_row(id=body.id, group_id=self.group_id, merchant='Dinner', amount_minor=16000, version=1),
            expense_row(id=body.id)]

        self.save(body)

        assert self.logged() == [(self.me.id, 'expense.edited', {'merchant': 'Dinner', 'amountMinor': 16350, 'previousMerchant': 'Dinner', 'previousAmountMinor': 16000})]

    def test_saving_the_same_thing_again_logs_nothing(self):
        body = self.body()
        self.expenses.expense.side_effect = [None, expense_row(id=body.id)]
        self.save(body)
        inserted = self.expenses.insert_expense.call_args.args[0]
        self.expenses.expense.side_effect = None
        self.expenses.expense.return_value = expense_row(**{k: v for k, v in inserted.items() if k != 'updated_at'})
        self.activity.record.reset_mock()

        self.save(body)

        self.activity.record.assert_not_called()

    def test_deleting_is_logged_once_and_deleting_again_logs_nothing(self):
        stored = expense_row(group_id=self.group_id, merchant='Dinner', amount_minor=16000)
        self.expenses.expense.return_value = stored

        self.service.delete_expense(str(self.group_id), str(stored.id), str(self.user_id))
        assert self.logged() == [(self.me.id, 'expense.deleted', {'merchant': 'Dinner', 'amountMinor': 16000})]

        self.activity.record.reset_mock()
        self.expenses.expense.return_value = expense_row(group_id=self.group_id, deleted_at=NOW)
        self.service.delete_expense(str(self.group_id), str(stored.id), str(self.user_id))
        self.activity.record.assert_not_called()


class TestForeignCurrencyExpense:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.expenses = MagicMock(spec_set=ExpenseRepository)
        self.activity = MagicMock(spec_set=ActivityRepository)
        self.me = member_row(name='Ada')
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.members.member_ids.return_value = {self.me.id}
        self.groups.group.return_value = group_row(id=self.group_id, currency_code='USD')
        self.expenses.expense.return_value = None
        self.service = ExpenseService(self.expenses, self.members, self.groups, MembershipGuard(self.members), self.activity)

    def body(self, **changes) -> ExpenseInput:
        base = {'id': str(uuid4()), 'merchant': 'Hotel', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 12960,
                'payerID': str(self.me.id), 'method': 'equal', 'participants': [str(self.me.id)],
                'currencyCode': 'EUR', 'originalMinor': 12000, 'rateMicros': 1_080_000}
        return ExpenseInput.model_validate({**base, **changes})

    def save(self, body):
        return self.service.save_expense(str(self.group_id), str(self.user_id), body)

    def test_the_original_amount_currency_and_rate_are_stored_with_the_converted_amount(self):
        body = self.body()
        self.expenses.expense.side_effect = [None, expense_row(id=body.id)]

        self.save(body)

        values = self.expenses.insert_expense.call_args.args[0]
        assert (values['amount_minor'], values['currency_code'], values['original_minor'], values['rate_micros']) == (12960, 'EUR', 12000, 1_080_000)

    def test_an_amount_that_does_not_match_the_rate_is_refused_with_the_expected_amount(self):
        with pytest.raises(APIError) as caught:
            self.save(self.body(amountMinor=12961))

        assert (caught.value.status, caught.value.code, caught.value.extra['expectedAmountMinor']) == (422, 'conversion_mismatch', 12960)
        self.expenses.insert_expense.assert_not_called()

    def test_the_groups_own_currency_is_not_a_foreign_currency(self):
        with pytest.raises(APIError) as caught:
            self.save(self.body(currencyCode='USD', amountMinor=12000, rateMicros=1_000_000))

        assert caught.value.status == 422

    def test_an_amount_too_small_to_convert_is_refused(self):
        with pytest.raises(APIError) as caught:
            self.save(self.body(currencyCode='JPY', originalMinor=1, rateMicros=1000, amountMinor=1))

        assert caught.value.status == 422

    @pytest.mark.parametrize('missing', ['currencyCode', 'originalMinor', 'rateMicros'])
    def test_the_three_fields_go_together(self, missing):
        data = {'id': str(uuid4()), 'merchant': 'Hotel', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 12960,
                'payerID': str(self.me.id), 'method': 'equal', 'participants': [str(self.me.id)],
                'currencyCode': 'EUR', 'originalMinor': 12000, 'rateMicros': 1_080_000}
        del data[missing]

        with pytest.raises(ValueError):
            ExpenseInput.model_validate(data)
