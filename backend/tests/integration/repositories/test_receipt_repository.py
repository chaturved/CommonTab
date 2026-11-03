from uuid import uuid4

import pytest

from app.repositories.expenses import ExpenseRepository
from app.repositories.receipts import ReceiptRepository
from seed import NOW, add_group, add_member, add_user


class TestReceiptRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = ReceiptRepository(connection)
        self.expenses = ExpenseRepository(connection)
        owner = add_user(connection)
        self.group = add_group(connection, owner)
        ada = add_member(connection, self.group, owner, 'Ada')
        self.expense = uuid4()
        self.expenses.insert_expense({
            'id': self.expense, 'group_id': self.group, 'merchant': 'Dinner', 'occurred_at': NOW, 'category': 'food',
            'notes': '', 'amount_minor': 100, 'payer_id': ada, 'method': 'equal',
            'allocations': [{'memberID': str(ada), 'minorUnits': 100}], 'input_values': [], 'version': 1,
            'updated_at': NOW})

    def test_a_stored_receipt_comes_back_byte_for_byte(self):
        assert self.repo.set_receipt(self.group, self.expense, b'\xff\xd8\xffdata', 'image/jpeg')

        row = self.repo.receipt(self.group, self.expense)

        assert (bytes(row.receipt), row.receipt_type) == (b'\xff\xd8\xffdata', 'image/jpeg')

    def test_the_expense_listing_reports_a_receipt_without_loading_it(self):
        self.repo.set_receipt(self.group, self.expense, b'data', 'image/jpeg')

        row = self.expenses.expense(self.expense)

        assert row.has_receipt and not hasattr(row, 'receipt')

    def test_clearing_removes_the_receipt(self):
        self.repo.set_receipt(self.group, self.expense, b'data', 'image/jpeg')

        assert self.repo.set_receipt(self.group, self.expense, None, None)

        assert self.repo.receipt(self.group, self.expense).receipt is None
        assert not self.expenses.expense(self.expense).has_receipt

    def test_an_expense_of_another_group_is_not_touched(self):
        other_group = add_group(self.repo.connection, add_user(self.repo.connection))

        assert not self.repo.set_receipt(other_group, self.expense, b'data', 'image/jpeg')
        assert self.repo.receipt(other_group, self.expense) is None

    def test_a_deleted_expense_cannot_take_or_give_a_receipt(self):
        self.repo.set_receipt(self.group, self.expense, b'data', 'image/jpeg')
        self.expenses.tombstone_expense(self.expense, NOW)

        assert not self.repo.set_receipt(self.group, self.expense, b'new', 'image/jpeg')
        assert self.repo.receipt(self.group, self.expense) is None
