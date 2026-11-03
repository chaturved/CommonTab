from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from argon2 import PasswordHasher

from app.core.errors import APIError
from app.core.security import hash_token
from app.repositories.password_resets import PasswordResetRepository
from app.repositories.users import UserRepository
from app.services.password_resets import MAX_ATTEMPTS, PasswordResetService
from rows import user_row

NEW_PASSWORD = 'a brand new passphrase'


def reset_row(code='ABCD2345', **changes) -> SimpleNamespace:
    return SimpleNamespace(**{'code_hash': hash_token(code), 'expires_at': datetime.now(timezone.utc) + timedelta(hours=1),
                              'used_at': None, 'attempts': 0, **changes})


class TestPasswordResetService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.resets = MagicMock(spec_set=PasswordResetRepository)
        self.users = MagicMock(spec_set=UserRepository)
        self.passwords = MagicMock(spec_set=PasswordHasher)
        self.passwords.hash.return_value = 'new-hash'
        self.ada = user_row(name='Ada', email='ada@example.com')
        self.users.user_by_email.return_value = self.ada
        self.resets.latest_created_at.return_value = None
        self.service = PasswordResetService(self.resets, self.users, self.passwords)

    # --- asking for a code

    def test_a_code_is_stored_hashed_and_returned_for_the_email(self):
        pending = self.service.request(' Ada@Example.com ')

        self.users.user_by_email.assert_called_once_with('ada@example.com')
        stored_hash, user_id, expires, _created = self.resets.insert.call_args.args
        assert pending.to == 'ada@example.com' and len(pending.code) == 9
        assert stored_hash == hash_token(pending.code.replace('-', '')) and user_id == self.ada.id
        assert timedelta(minutes=59) < expires - datetime.now(timezone.utc) <= timedelta(hours=1)

    def test_a_new_code_replaces_the_earlier_ones(self):
        self.service.request('ada@example.com')

        self.resets.supersede.assert_called_once()
        assert self.resets.supersede.call_args.args[0] == self.ada.id

    def test_an_unknown_email_gets_nothing_and_stores_nothing(self):
        self.users.user_by_email.return_value = None

        assert self.service.request('nobody@example.com') is None
        self.resets.insert.assert_not_called()

    def test_asking_again_within_a_minute_sends_nothing_new(self):
        self.resets.latest_created_at.return_value = datetime.now(timezone.utc) - timedelta(seconds=10)

        assert self.service.request('ada@example.com') is None
        self.resets.insert.assert_not_called()

    def test_asking_again_after_a_minute_sends_a_new_code(self):
        self.resets.latest_created_at.return_value = datetime.now(timezone.utc) - timedelta(seconds=61)

        assert self.service.request('ada@example.com') is not None

    def test_a_malformed_email_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.request('not-an-email')

        assert caught.value.status == 422

    # --- using a code

    def test_the_right_code_sets_the_password_signs_everyone_out_and_uses_the_code_up(self):
        self.resets.active.return_value = reset_row()

        assert self.service.confirm('ada@example.com', 'abcd-2345', NEW_PASSWORD) is True

        self.passwords.hash.assert_called_once_with(NEW_PASSWORD)
        self.users.set_password.assert_called_once_with(self.ada.id, 'new-hash')
        self.users.delete_tokens_for_user.assert_called_once_with(self.ada.id)
        assert self.resets.mark_used.call_args.args[0] == hash_token('ABCD2345')

    def test_a_wrong_code_changes_nothing_and_counts_the_guess(self):
        self.resets.active.return_value = reset_row()
        self.resets.record_failed_attempt.return_value = 1

        assert self.service.confirm('ada@example.com', 'ZZZZ-ZZZZ', NEW_PASSWORD) is False

        self.resets.record_failed_attempt.assert_called_once_with(hash_token('ABCD2345'))
        self.users.set_password.assert_not_called()
        self.resets.mark_used.assert_not_called()

    def test_a_code_that_cannot_be_a_code_also_counts_as_a_guess(self):
        self.resets.active.return_value = reset_row()
        self.resets.record_failed_attempt.return_value = 1

        assert self.service.confirm('ada@example.com', 'nope', NEW_PASSWORD) is False
        self.resets.record_failed_attempt.assert_called_once()

    def test_the_last_allowed_wrong_guess_burns_the_code(self):
        self.resets.active.return_value = reset_row()
        self.resets.record_failed_attempt.return_value = MAX_ATTEMPTS

        self.service.confirm('ada@example.com', 'ZZZZ-ZZZZ', NEW_PASSWORD)

        assert self.resets.mark_used.call_args.args[0] == hash_token('ABCD2345')

    def test_an_expired_code_fails_without_counting(self):
        self.resets.active.return_value = reset_row(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))

        assert self.service.confirm('ada@example.com', 'ABCD-2345', NEW_PASSWORD) is False
        self.resets.record_failed_attempt.assert_not_called()
        self.users.set_password.assert_not_called()

    def test_no_active_code_fails(self):
        self.resets.active.return_value = None

        assert self.service.confirm('ada@example.com', 'ABCD-2345', NEW_PASSWORD) is False

    def test_an_unknown_email_fails_the_same_way(self):
        self.users.user_by_email.return_value = None

        assert self.service.confirm('nobody@example.com', 'ABCD-2345', NEW_PASSWORD) is False
        self.resets.active.assert_not_called()
