from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.users import UserRepository
from seed import NOW, add_user


class TestUserRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.connection = connection
        self.repo = UserRepository(connection)

    def test_inserting_a_user_and_reading_it_back_by_email_and_id(self):
        user_id = uuid4()

        assert self.repo.insert_user(user_id, 'ada@example.com', 'Ada', 'hash', NOW)

        assert self.repo.user_by_email('ada@example.com').id == user_id
        assert self.repo.user_by_id(user_id).name == 'Ada'

    def test_a_second_user_with_the_same_email_is_not_inserted(self):
        self.repo.insert_user(uuid4(), 'ada@example.com', 'Ada', 'hash', NOW)

        assert not self.repo.insert_user(uuid4(), 'ada@example.com', 'Other', 'hash', NOW)
        assert self.repo.user_by_email('ada@example.com').name == 'Ada'

    def test_unknown_users_are_none(self):
        assert self.repo.user_by_email('nobody@example.com') is None
        assert self.repo.user_by_id(uuid4()) is None

    def test_renaming_changes_only_the_name(self):
        user_id = add_user(self.connection, 'ada@example.com', 'Ada')

        self.repo.rename(user_id, 'Ada L')

        assert self.repo.user_by_id(user_id).name == 'Ada L'

    def test_a_token_is_found_by_its_hash_until_it_is_deleted(self):
        user_id = add_user(self.connection)
        self.repo.insert_token('hash-1', user_id, NOW + timedelta(days=1))

        assert self.repo.token('hash-1').user_id == user_id
        self.repo.delete_token('hash-1')
        assert self.repo.token('hash-1') is None

    def test_setting_a_password_replaces_only_the_hash(self):
        user_id = add_user(self.connection, 'ada@example.com', 'Ada')

        self.repo.set_password(user_id, 'new-hash')

        row = self.repo.user_by_id(user_id)
        assert (row.password_hash, row.name) == ('new-hash', 'Ada')

    def test_signing_out_everywhere_deletes_every_token_of_that_account_only(self):
        ada, bob = add_user(self.connection), add_user(self.connection)
        for token, user in (('a1', ada), ('a2', ada), ('b1', bob)):
            self.repo.insert_token(token, user, NOW + timedelta(days=1))

        self.repo.delete_tokens_for_user(ada)

        assert self.repo.token('a1') is None and self.repo.token('a2') is None
        assert self.repo.token('b1') is not None
