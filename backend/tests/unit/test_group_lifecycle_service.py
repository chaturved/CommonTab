from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.groups import GroupService
from app.services.snapshots import SnapshotBuilder
from rows import group_row, member_row


class TestGroupLifecycle:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.groups = MagicMock(spec_set=GroupRepository)
        self.members = MagicMock(spec_set=MemberRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        self.me = member_row(name='Ada')
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.groups.group.return_value = group_row(id=self.group_id, owner_id=uuid4())
        self.settled()
        self.service = GroupService(self.groups, self.members, MagicMock(spec_set=UserRepository), MembershipGuard(self.members), self.snapshots)

    def owing(self, minor: int) -> None:
        self.snapshots.build.return_value = {'balances': [{'memberID': str(self.me.id), 'minorUnits': minor}, {'memberID': 'sam', 'minorUnits': -minor}]}

    def settled(self) -> None:
        self.owing(0)

    def own_the_group(self) -> None:
        self.groups.group.return_value = group_row(id=self.group_id, owner_id=self.user_id)

    def refused(self, call, *args) -> APIError:
        with pytest.raises(APIError) as caught:
            call(str(self.group_id), *args)
        return caught.value

    def test_the_list_has_groups_you_can_use_and_those_you_lost_access_to(self):
        gone = SimpleNamespace(id=uuid4(), name='Austin Trip', status='removed', since=datetime(2026, 11, 2, tzinfo=timezone.utc))
        self.groups.group_ids_for_user.return_value = [self.group_id]
        self.groups.closed_for_user.return_value = [gone]
        self.snapshots.build.return_value = {'id': str(self.group_id)}

        listed = self.service.list_groups(str(self.user_id))

        assert listed[0] == {'id': str(self.group_id)}
        assert listed[1] == {'id': str(gone.id), 'name': 'Austin Trip', 'status': 'removed', 'since': '2026-11-02T00:00:00Z'}

    def test_leaving_when_even_removes_you_and_changes_the_version(self):
        self.service.leave(str(self.group_id), str(self.user_id))

        assert self.members.remove_member.call_args.args[0] == self.me.id
        self.groups.bump_version.assert_called_once_with(self.group_id)
        self.groups.set_owner.assert_not_called()

    @pytest.mark.parametrize('minor', [10900, -1800])
    def test_leaving_while_owed_or_owing_is_409_with_the_amount(self, minor):
        self.owing(minor)

        error = self.refused(self.service.leave, str(self.user_id))

        assert (error.status, error.code, error.extra) == (409, 'owes_balance', {'balanceMinor': minor})
        self.members.remove_member.assert_not_called()

    def test_the_owner_leaving_hands_the_group_to_the_longest_standing_other_account(self):
        sam = uuid4()
        self.own_the_group()
        self.members.other_user_ids.return_value = [sam, uuid4()]

        self.service.leave(str(self.group_id), str(self.user_id))

        self.groups.set_owner.assert_called_once_with(self.group_id, sam)

    def test_the_only_account_cannot_leave_and_is_told_to_delete_the_group(self):
        self.own_the_group()
        self.members.other_user_ids.return_value = []

        error = self.refused(self.service.leave, str(self.user_id))

        assert (error.status, error.code) == (409, 'last_account')
        self.members.remove_member.assert_not_called()

    def test_the_owner_can_remove_someone_even_while_they_owe(self):
        self.own_the_group()
        sam = member_row(group_id=self.group_id, user_id=None, name='Sam')
        self.members.member.return_value = sam
        self.owing(1800)

        self.service.remove_member(str(self.group_id), str(sam.id), str(self.user_id))

        assert self.members.remove_member.call_args.args[0] == sam.id

    def test_only_the_owner_can_remove_people(self):
        error = self.refused(self.service.remove_member, str(uuid4()), str(self.user_id))

        assert (error.status, error.code) == (403, 'not_owner')

    def test_you_cannot_remove_yourself_that_is_leaving(self):
        self.own_the_group()
        self.members.member.return_value = member_row(group_id=self.group_id, user_id=self.user_id)

        error = self.refused(self.service.remove_member, str(uuid4()), str(self.user_id))

        assert (error.status, error.code) == (409, 'use_leave')

    @pytest.mark.parametrize('already_gone', [False, True])
    def test_removing_someone_who_is_not_here_or_already_gone_is_404(self, already_gone):
        self.own_the_group()
        self.members.member.return_value = member_row(group_id=self.group_id, removed_at=datetime(2026, 1, 1, tzinfo=timezone.utc)) if already_gone else None

        assert self.refused(self.service.remove_member, str(uuid4()), str(self.user_id)).status == 404

    def test_archiving_needs_everyone_settled(self):
        self.service.archive(str(self.group_id), str(self.user_id))
        self.groups.archive.assert_called_once()

        self.owing(500)
        error = self.refused(self.service.archive, str(self.user_id))
        assert (error.status, error.code) == (409, 'not_settled')

    def test_unarchiving_is_always_allowed_to_members(self):
        self.service.unarchive(str(self.group_id), str(self.user_id))

        self.groups.unarchive.assert_called_once_with(self.group_id)

    def test_deleting_is_for_the_owner_when_settled(self):
        self.own_the_group()

        self.service.delete_group(str(self.group_id), str(self.user_id))
        self.groups.soft_delete.assert_called_once()

        self.owing(100)
        assert self.refused(self.service.delete_group, str(self.user_id)).code == 'not_settled'

    def test_a_member_who_is_not_the_owner_cannot_delete(self):
        assert self.refused(self.service.delete_group, str(self.user_id)).code == 'not_owner'
        self.groups.soft_delete.assert_not_called()

    def test_a_removed_person_gets_404_from_the_guard(self):
        self.members.member_of.return_value = None

        assert self.refused(self.service.leave, str(self.user_id)).status == 404
