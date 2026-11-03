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
