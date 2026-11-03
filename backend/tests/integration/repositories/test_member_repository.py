from uuid import uuid4

import pytest

from app.repositories.members import MemberRepository
from seed import NOW, add_group, add_member, add_user


class TestMemberRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.connection = connection
        self.repo = MemberRepository(connection)
        self.ada_user = add_user(connection, 'ada@example.com', 'Ada')
        self.group = add_group(connection, self.ada_user)

    def test_inserting_a_member_is_true_and_a_repeated_id_is_false(self):
        member_id = uuid4()

        assert self.repo.insert_member(member_id, self.group, None, 'Sam', NOW)
        assert not self.repo.insert_member(member_id, self.group, None, 'Sam again', NOW)
        assert self.repo.member(member_id).name == 'Sam'

    def test_an_account_can_be_in_a_group_only_once(self):
        assert self.repo.insert_member(uuid4(), self.group, self.ada_user, 'Ada', NOW)

        assert not self.repo.insert_member(uuid4(), self.group, self.ada_user, 'Ada again', NOW)

    def test_people_without_accounts_are_not_limited(self):
        assert self.repo.insert_member(uuid4(), self.group, None, 'Sam', NOW)
        assert self.repo.insert_member(uuid4(), self.group, None, 'Sam', NOW)

    def test_member_of_finds_the_member_linked_to_an_account(self):
        ada = add_member(self.connection, self.group, self.ada_user, 'Ada')
        add_member(self.connection, self.group, None, 'Sam')

        assert self.repo.member_of(self.group, self.ada_user).id == ada
        assert self.repo.member_of(self.group, uuid4()) is None

    def test_members_come_back_by_name_with_the_account_email_when_there_is_one(self):
        add_member(self.connection, self.group, None, 'Sam')
        add_member(self.connection, self.group, self.ada_user, 'Ada')

        members = self.repo.members(self.group)

        assert [(m.name, m.email) for m in members] == [('Ada', 'ada@example.com'), ('Sam', None)]

    def test_member_ids_are_the_groups_own(self):
        sam = add_member(self.connection, self.group, None, 'Sam')
        other_group = add_group(self.connection, self.ada_user)
        add_member(self.connection, other_group, None, 'Elsewhere')

        assert self.repo.member_ids(self.group) == {sam}

    def test_linking_a_person_to_an_account_makes_them_findable_by_it(self):
        sam = add_member(self.connection, self.group, None, 'Sam')
        cy_user = add_user(self.connection, 'cy@example.com', 'Cy')

        self.repo.link_member(sam, cy_user)

        assert self.repo.member_of(self.group, cy_user).id == sam
        assert self.repo.member(sam).email == 'cy@example.com'

    def test_renaming_changes_the_name(self):
        sam = add_member(self.connection, self.group, None, 'Sam')

        self.repo.rename_member(sam, 'Samuel')

        assert self.repo.member(sam, lock=True).name == 'Samuel'

    def test_is_member_email_matches_accounts_in_this_group_only(self):
        add_member(self.connection, self.group, self.ada_user, 'Ada')
        other_group = add_group(self.connection, self.ada_user)

        assert self.repo.is_member_email(self.group, 'ada@example.com')
        assert not self.repo.is_member_email(other_group, 'ada@example.com')
        assert not self.repo.is_member_email(self.group, 'nobody@example.com')
