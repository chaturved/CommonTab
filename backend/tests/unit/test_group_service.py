from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.schemas.groups import GroupInput
from app.services.access import MembershipGuard
from app.services.groups import GroupService
from app.services.snapshots import SnapshotBuilder
from rows import group_row, member_row, user_row


def group_input(**changes) -> GroupInput:
    return GroupInput.model_validate({'name': 'Trip', 'currencyCode': 'USD', **changes})


class TestGroupService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.groups = MagicMock(spec_set=GroupRepository)
        self.members = MagicMock(spec_set=MemberRepository)
        self.users = MagicMock(spec_set=UserRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        self.me = member_row(name='Ada')  # the signed-in member
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.users.user_by_id.return_value = user_row(name='Ada')
        self.groups.insert_group.return_value = True
        self.members.insert_member.return_value = True
        self.snapshots.build.return_value = {'id': 'snapshot'}
        self.service = GroupService(self.groups, self.members, self.users, MembershipGuard(self.members),
                                    self.snapshots)

    # --- create

    def test_creating_a_group_adds_the_creator_as_its_only_member(self):
        snapshot, created = self.service.create_group(str(self.user_id), group_input())

        assert created and snapshot == {'id': 'snapshot'}
        self.members.insert_member.assert_called_once()
        member_args = self.members.insert_member.call_args.args
        assert member_args[2:4] == (self.user_id, 'Ada')

    def test_creating_with_members_links_only_the_signed_in_one_to_the_account(self):
        ada, sam = uuid4(), uuid4()
        body = group_input(members=[{'id': str(ada), 'name': 'Ada'}, {'id': str(sam), 'name': ' Sam '}],
                           meMemberID=str(ada))

        self.service.create_group(str(self.user_id), body)

        linked = {call.args[0]: (call.args[2], call.args[3]) for call in self.members.insert_member.call_args_list}
        assert linked == {ada: (self.user_id, 'Ada'), sam: (None, 'Sam')}

    def test_a_blank_group_name_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.create_group(str(self.user_id), group_input(name='   '))

        assert caught.value.status == 422
        self.groups.insert_group.assert_not_called()

    def test_a_member_id_that_is_already_taken_is_an_id_conflict(self):
        self.members.insert_member.return_value = False

        with pytest.raises(APIError) as caught:
            self.service.create_group(str(self.user_id), group_input())

        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    # --- repeating a create

    def test_repeating_the_same_create_returns_the_group_without_creating_it_again(self):
        self.groups.insert_group.return_value = False
        self.groups.group.return_value = group_row(name='Trip', currency_code='USD')

        snapshot, created = self.service.create_group(str(self.user_id), group_input(id=str(self.group_id)))

        assert not created and snapshot == {'id': 'snapshot'}
        self.members.insert_member.assert_not_called()

    def test_the_same_id_with_another_name_is_an_id_conflict(self):
        self.groups.insert_group.return_value = False
        self.groups.group.return_value = group_row(name='Other', currency_code='USD')

        with pytest.raises(APIError) as caught:
            self.service.create_group(str(self.user_id), group_input(id=str(self.group_id)))

        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_an_id_that_belongs_to_someone_elses_group_is_an_id_conflict(self):
        self.groups.insert_group.return_value = False
        self.groups.group.return_value = group_row(name='Trip', currency_code='USD')
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.create_group(str(self.user_id), group_input(id=str(uuid4())))

        assert caught.value.code == 'id_conflict'

    # --- read and rename

    def test_listing_builds_a_snapshot_per_group(self):
        self.groups.group_ids_for_user.return_value = [uuid4(), uuid4()]

        result = self.service.list_groups(str(self.user_id))

        assert len(result) == 2 and self.snapshots.build.call_count == 2

    def test_reading_a_group_needs_membership(self):
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.group(str(self.group_id), str(self.user_id))

        assert caught.value.status == 404
        self.snapshots.build.assert_not_called()

    def test_renaming_trims_the_name(self):
        self.service.rename_group(str(self.group_id), str(self.user_id), '  Spain  ')

        self.groups.rename_group.assert_called_once_with(self.group_id, 'Spain')

    def test_renaming_to_a_blank_name_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.rename_group(str(self.group_id), str(self.user_id), '  ')

        assert caught.value.status == 422

    # --- people

    def test_adding_a_person_inserts_them_and_bumps_the_group(self):
        self.members.member.side_effect = [None, member_row(name='Sam')]
        sam = uuid4()

        self.service.put_member(str(self.group_id), str(sam), str(self.user_id), ' Sam ')

        assert self.members.insert_member.call_args.args[:4] == (sam, self.group_id, None, 'Sam')
        self.groups.bump_version.assert_called_once_with(self.group_id)

    def test_repeating_the_same_name_changes_nothing(self):
        sam = member_row(group_id=self.group_id, name='Sam')
        self.members.member.return_value = sam

        self.service.put_member(str(self.group_id), str(sam.id), str(self.user_id), 'Sam')

        self.members.insert_member.assert_not_called()
        self.members.rename_member.assert_not_called()
        self.groups.bump_version.assert_not_called()

    def test_a_new_name_renames_the_person_and_bumps_the_group(self):
        sam = member_row(group_id=self.group_id, name='Sam')
        self.members.member.return_value = sam

        self.service.put_member(str(self.group_id), str(sam.id), str(self.user_id), 'Samuel')

        self.members.rename_member.assert_called_once_with(sam.id, 'Samuel')
        self.groups.bump_version.assert_called_once_with(self.group_id)

    def test_a_person_from_another_group_is_an_id_conflict(self):
        self.members.member.return_value = member_row(group_id=uuid4(), name='Sam')

        with pytest.raises(APIError) as caught:
            self.service.put_member(str(self.group_id), str(uuid4()), str(self.user_id), 'Sam')

        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    def test_a_blank_person_name_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.put_member(str(self.group_id), str(uuid4()), str(self.user_id), ' ')

        assert caught.value.status == 422
