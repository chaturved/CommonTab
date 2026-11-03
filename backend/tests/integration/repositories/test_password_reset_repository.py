from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.password_resets import PasswordResetRepository
from seed import NOW, add_user


class TestPasswordResetRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = PasswordResetRepository(connection)
        self.user = add_user(connection)

    def insert(self, code_hash='h1', created=NOW, user=None):
        self.repo.insert(code_hash, user or self.user, created + timedelta(hours=1), created)

    def test_the_newest_unused_code_is_the_active_one(self):
        self.insert('old', NOW)
        self.insert('new', NOW + timedelta(minutes=5))

        assert self.repo.active(self.user).code_hash == 'new'

    def test_a_used_code_is_not_active(self):
        self.insert('h1')
        self.repo.mark_used('h1', NOW)

        assert self.repo.active(self.user) is None

    def test_a_new_code_supersedes_the_ones_before_it(self):
        self.insert('h1')
        self.insert('h2', NOW + timedelta(minutes=2))

        self.repo.supersede(self.user, NOW + timedelta(minutes=3))

        assert self.repo.active(self.user) is None

    def test_codes_of_other_accounts_are_not_touched(self):
        other = add_user(self.repo.connection)
        self.insert('mine')
        self.insert('theirs', user=other)

        self.repo.supersede(self.user, NOW)

        assert self.repo.active(other).code_hash == 'theirs'

    def test_the_latest_creation_time_covers_used_codes_too(self):
        assert self.repo.latest_created_at(self.user) is None
        self.insert('h1', NOW)
        self.insert('h2', NOW + timedelta(minutes=2))
        self.repo.mark_used('h2', NOW + timedelta(minutes=3))

        assert self.repo.latest_created_at(self.user) == NOW + timedelta(minutes=2)

    def test_wrong_guesses_are_counted(self):
        self.insert('h1')

        assert [self.repo.record_failed_attempt('h1') for _ in range(3)] == [1, 2, 3]
        assert self.repo.active(self.user).attempts == 3

    def test_an_unknown_user_has_no_active_code(self):
        assert self.repo.active(uuid4()) is None
