from uuid import uuid4

import pytest

from app.repositories.groups import GroupRepository
from seed import NOW, add_group, add_member, add_user


class TestGroupRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.connection = connection
        self.repo = GroupRepository(connection)
        self.owner = add_user(connection)

    def test_a_new_group_starts_at_version_1(self):
        group_id = uuid4()

        assert self.repo.insert_group(group_id, 'Trip', 'EUR', self.owner, NOW)

        group = self.repo.group(group_id)
        assert (group.name, group.currency_code, group.owner_id, group.version) == ('Trip', 'EUR', self.owner, 1)

    def test_inserting_an_existing_id_changes_nothing_and_says_so(self):
        group_id = add_group(self.connection, self.owner)

        assert not self.repo.insert_group(group_id, 'Other name', 'EUR', self.owner, NOW)
        assert self.repo.group(group_id).name == 'Trip'

    def test_every_write_bumps_the_version(self):
        group_id = add_group(self.connection, self.owner)

        self.repo.bump_version(group_id)
        self.repo.rename_group(group_id, 'Spain')

        group = self.repo.group(group_id)
        assert (group.name, group.version) == ('Spain', 3)

    def test_a_locking_read_returns_the_same_row(self):
        group_id = add_group(self.connection, self.owner)

        assert self.repo.group(group_id, lock=True).id == group_id

    def test_a_user_sees_only_the_groups_they_are_a_member_of(self):
        mine, other = add_group(self.connection, self.owner), add_group(self.connection, self.owner)
        add_member(self.connection, mine, self.owner)

        assert self.repo.group_ids_for_user(self.owner) == [mine]
        assert other not in self.repo.group_ids_for_user(self.owner)

    def test_the_owner_can_be_handed_to_another_account(self):
        group_id = add_group(self.connection, self.owner)
        sam = add_user(self.connection, name='Sam')

        self.repo.set_owner(group_id, sam)

        assert self.repo.group(group_id).owner_id == sam

    def test_deleting_a_group_removes_its_people_expenses_and_payments_only(self):
        from app.repositories.expenses import ExpenseRepository
        from app.repositories.settlements import SettlementRepository
        group_id = add_group(self.connection, self.owner)
        ada = add_member(self.connection, group_id, self.owner, 'Ada')
        sam = add_member(self.connection, group_id, None, 'Sam')
        other = add_group(self.connection, self.owner)
        keep = add_member(self.connection, other, self.owner, 'Ada')
        ExpenseRepository(self.connection).insert_expense({
            'id': uuid4(), 'group_id': group_id, 'merchant': 'Dinner', 'occurred_at': NOW, 'category': 'other', 'notes': '',
            'amount_minor': 1000, 'payer_id': ada, 'method': 'equal', 'allocations': [], 'input_values': [], 'version': 1,
            'updated_at': NOW})
        SettlementRepository(self.connection).insert_settlement(uuid4(), group_id, sam, ada, 100, NOW)

        self.repo.delete_group(group_id)

        assert self.repo.group(group_id) is None
        assert self.repo.group(other) is not None
        from sqlalchemy import text
        counts = self.connection.execute(text('''SELECT (SELECT count(*) FROM members WHERE group_id=:g),
                                                        (SELECT count(*) FROM expenses WHERE group_id=:g),
                                                        (SELECT count(*) FROM settlements WHERE group_id=:g)'''), {'g': group_id}).one()
        assert tuple(counts) == (0, 0, 0)
        assert keep is not None
