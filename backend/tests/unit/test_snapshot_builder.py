from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.settlements import SettlementRepository
from app.services.snapshots import SnapshotBuilder
from rows import NOW, expense_row, group_row, member_row, settlement_row


class TestSnapshotBuilder:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.groups = MagicMock(spec_set=GroupRepository)
        self.members = MagicMock(spec_set=MemberRepository)
        self.expenses = MagicMock(spec_set=ExpenseRepository)
        self.settlements = MagicMock(spec_set=SettlementRepository)
        self.group_id, self.user_id = uuid4(), uuid4()
        self.ada = member_row(group_id=self.group_id, user_id=self.user_id, name='Ada')
        self.sam = member_row(group_id=self.group_id, user_id=None, name='Sam')
        self.groups.group.return_value = group_row(id=self.group_id, owner_id=self.user_id, version=4)
        self.members.members.return_value = [self.ada, self.sam]
        self.expenses.expenses.return_value = []
        self.settlements.settlements.return_value = []
        self.builder = SnapshotBuilder(self.groups, self.members, self.expenses, self.settlements)

    def dinner(self, **changes):
        shares = [{'memberID': str(self.ada.id), 'minorUnits': 500}, {'memberID': str(self.sam.id), 'minorUnits': 500}]
        return expense_row(group_id=self.group_id, payer_id=self.ada.id, amount_minor=1000, allocations=shares, **changes)

    def test_describes_the_group_for_the_signed_in_member(self):
        snapshot = self.builder.build(self.group_id, self.user_id)

        assert snapshot['id'] == str(self.group_id) and snapshot['version'] == 4
        assert snapshot['meMemberID'] == snapshot['ownerID'] == str(self.ada.id)
        assert [m['name'] for m in snapshot['members']] == ['Ada', 'Sam']
        assert snapshot['members'][1]['userID'] is None

    def test_balances_follow_who_paid_and_who_shares(self):
        self.expenses.expenses.return_value = [self.dinner()]

        snapshot = self.builder.build(self.group_id, self.user_id)

        assert snapshot['balances'] == [{'memberID': str(self.ada.id), 'minorUnits': 500},
                                        {'memberID': str(self.sam.id), 'minorUnits': -500}]

    def test_deleted_expenses_are_listed_apart_and_do_not_count(self):
        self.expenses.expenses.return_value = [self.dinner(), self.dinner(deleted_at=NOW)]

        snapshot = self.builder.build(self.group_id, self.user_id)

        assert len(snapshot['expenses']) == 1 and len(snapshot['deletedExpenses']) == 1
        assert snapshot['balances'][0]['minorUnits'] == 500

    def test_settlements_move_the_balances(self):
        self.expenses.expenses.return_value = [self.dinner()]
        self.settlements.settlements.return_value = [
            settlement_row(group_id=self.group_id, from_id=self.sam.id, to_id=self.ada.id, amount_minor=200)]

        snapshot = self.builder.build(self.group_id, self.user_id)

        assert [b['minorUnits'] for b in snapshot['balances']] == [300, -300]
        assert snapshot['settlements'][0]['amountMinor'] == 200
