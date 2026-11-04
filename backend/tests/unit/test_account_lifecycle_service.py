from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.errors import APIError
from app.core.security import hash_token
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.services.accounts import AccountService
from rows import user_row


class TestChangingThePassword:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ada = user_row(password_hash='old-hash')
        self.users = MagicMock(spec_set=UserRepository)
        self.users.user_by_id.return_value = self.ada
        self.passwords = MagicMock(spec_set=PasswordHasher)
        self.passwords.hash.return_value = 'new-hash'
        self.service = AccountService(self.users, self.passwords, MagicMock(spec_set=GroupRepository), MagicMock(spec_set=MemberRepository))

    def test_the_new_password_is_stored_hashed_and_other_sessions_end_but_this_one_stays(self):
        self.service.change_password(str(self.ada.id), 'my-token', 'old password', 'a new long password')

        self.passwords.verify.assert_called_once_with('old-hash', 'old password')
        self.users.set_password.assert_called_once_with(self.ada.id, 'new-hash')
        self.users.delete_tokens_except.assert_called_once_with(self.ada.id, hash_token('my-token'))

    def test_a_wrong_current_password_is_403_wrong_password_and_changes_nothing(self):
        self.passwords.verify.side_effect = VerifyMismatchError()

        with pytest.raises(APIError) as caught:
            self.service.change_password(str(self.ada.id), 'my-token', 'nope', 'a new long password')

        assert (caught.value.status, caught.value.code) == (403, 'wrong_password')
        self.users.set_password.assert_not_called()
        self.users.delete_tokens_except.assert_not_called()


class TestDeletingTheAccount:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ada = user_row(password_hash='hash')
        self.users = MagicMock(spec_set=UserRepository)
        self.users.user_by_id.return_value = self.ada
        self.passwords = MagicMock(spec_set=PasswordHasher)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.members = MagicMock(spec_set=MemberRepository)
        self.service = AccountService(self.users, self.passwords, self.groups, self.members)

    def delete(self):
        self.service.delete_account(str(self.ada.id), 'password')

    def test_a_group_nobody_else_belongs_to_is_deleted(self):
        group_id = uuid4()
        self.groups.group_ids_for_user.return_value = [group_id]
        self.members.other_user_ids.return_value = []

        self.delete()

        self.groups.delete_group.assert_called_once_with(group_id)
        self.groups.set_owner.assert_not_called()

    def test_a_group_you_own_goes_to_its_longest_standing_other_account(self):
        group_id, sam, riya = uuid4(), uuid4(), uuid4()
        self.groups.group_ids_for_user.return_value = [group_id]
        self.members.other_user_ids.return_value = [sam, riya]
        self.groups.group.return_value = MagicMock(owner_id=self.ada.id)

        self.delete()

        self.groups.set_owner.assert_called_once_with(group_id, sam)
        self.groups.bump_version.assert_called_once_with(group_id)
        self.groups.delete_group.assert_not_called()

    def test_a_group_you_do_not_own_keeps_its_owner_but_still_changes_version(self):
        group_id = uuid4()
        self.groups.group_ids_for_user.return_value = [group_id]
        self.members.other_user_ids.return_value = [uuid4()]
        self.groups.group.return_value = MagicMock(owner_id=uuid4())

        self.delete()

        self.groups.set_owner.assert_not_called()
        self.groups.bump_version.assert_called_once_with(group_id)

    def test_the_person_stays_in_shared_groups_and_everything_of_the_account_is_removed(self):
        self.groups.group_ids_for_user.return_value = []

        self.delete()

        self.members.unlink_user.assert_called_once_with(self.ada.id)
        self.users.delete_tokens_for_user.assert_called_once_with(self.ada.id)
        self.users.delete_password_resets.assert_called_once_with(self.ada.id)
        self.users.delete_user.assert_called_once_with(self.ada.id)

    def test_a_wrong_password_deletes_nothing(self):
        self.passwords.verify.side_effect = VerifyMismatchError()

        with pytest.raises(APIError) as caught:
            self.delete()

        assert caught.value.code == 'wrong_password'
        self.groups.delete_group.assert_not_called()
        self.users.delete_user.assert_not_called()
