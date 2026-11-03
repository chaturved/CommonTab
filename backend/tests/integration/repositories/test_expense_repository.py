from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.expenses import ExpenseRepository
from seed import NOW, add_group, add_member, add_user


class TestExpenseRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.connection = connection
        self.repo = ExpenseRepository(connection)
        owner = add_user(connection)
        self.group = add_group(connection, owner)
        self.ada = add_member(connection, self.group, owner, 'Ada')
        self.sam = add_member(connection, self.group, None, 'Sam')

    def values(self, **changes) -> dict:
        shares = [{'memberID': str(self.ada), 'minorUnits': 501}, {'memberID': str(self.sam), 'minorUnits': 500}]
        return {'id': uuid4(), 'group_id': self.group, 'merchant': 'Dinner', 'occurred_at': NOW, 'category': 'food',
                'notes': '', 'amount_minor': 1001, 'payer_id': self.ada, 'method': 'equal', 'allocations': shares,
                'input_values': [], 'version': 1, 'updated_at': NOW, **changes}

    def test_an_inserted_expense_comes_back_with_its_json_intact(self):
        values = self.values()
        self.repo.insert_expense(values)

        row = self.repo.expense(values['id'])

        assert row.allocations == values['allocations'] and row.input_values == []
        assert (row.version, row.amount_minor, row.deleted_at, row.has_receipt) == (1, 1001, None, False)

    def test_an_unknown_expense_is_none(self):
        assert self.repo.expense(uuid4()) is None

    def test_the_group_lists_its_own_expenses_newest_first(self):
        old = self.values(occurred_at=NOW - timedelta(days=1))
        new = self.values()
        for values in (old, new):
            self.repo.insert_expense(values)

        assert [row.id for row in self.repo.expenses(self.group)] == [new['id'], old['id']]
        assert self.repo.expenses(add_group(self.connection, add_user(self.connection))) == []

    def test_updating_rewrites_every_field_and_can_clear_the_deletion_mark(self):
        values = self.values()
        self.repo.insert_expense(values)
        self.repo.tombstone_expense(values['id'], NOW)

        self.repo.update_expense({**values, 'merchant': 'Brunch', 'version': 3, 'deleted_at': None,
                                  'updated_at': NOW + timedelta(hours=1)})

        row = self.repo.expense(values['id'])
        assert (row.merchant, row.version, row.deleted_at) == ('Brunch', 3, None)

    def test_deleting_leaves_a_tombstone_with_a_higher_version(self):
        values = self.values()
        self.repo.insert_expense(values)

        self.repo.tombstone_expense(values['id'], NOW + timedelta(minutes=5))

        row = self.repo.expense(values['id'])
        assert row.deleted_at == NOW + timedelta(minutes=5) and row.version == 2
        assert row.updated_at == NOW + timedelta(minutes=5)
        assert [r.id for r in self.repo.expenses(self.group)] == [values['id']]

    def test_a_locking_read_returns_the_same_row(self):
        values = self.values()
        self.repo.insert_expense(values)

        assert self.repo.expense(values['id'], lock=True).id == values['id']
