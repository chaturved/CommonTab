from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.errors import APIError
from app.core.security import hash_token
from app.repositories.users import UserRepository
from app.schemas.accounts import AccountInput
from app.services.accounts import AccountService
from rows import user_row

PASSWORD = 'correct horse battery staple'


class TestAccountService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.users = MagicMock(spec_set=UserRepository)
        self.passwords = MagicMock(spec_set=PasswordHasher)
        self.passwords.hash.return_value = 'hashed'
        self.ada = user_row(name='Ada', email='ada@example.com', password_hash='hashed')
        self.users.insert_user.return_value = True
        self.users.user_by_email.return_value = self.ada
        self.service = AccountService(self.users, self.passwords)

    def account_input(self, **changes) -> AccountInput:
        return AccountInput.model_validate({'email': 'Ada@Example.com', 'name': ' Ada ', 'password': PASSWORD, **changes})


    def test_signing_up_stores_a_trimmed_name_a_lowercase_email_and_only_the_password_hash(self):
        self.service.register(self.account_input())

        stored = self.users.insert_user.call_args.args
        assert stored[1:4] == ('ada@example.com', 'Ada', 'hashed')
        self.passwords.hash.assert_called_once_with(PASSWORD)

    def test_signing_up_signs_the_person_in(self):
        session = self.service.register(self.account_input())

        assert session['user'] == {'id': str(self.ada.id), 'email': 'ada@example.com', 'name': 'Ada'}
        assert session['accessToken']

    def test_an_email_that_is_already_registered_is_a_conflict(self):
        self.users.insert_user.return_value = False

        with pytest.raises(APIError) as caught:
            self.service.register(self.account_input())

        assert caught.value.status == 409

    def test_a_blank_name_is_rejected_before_hashing(self):
        with pytest.raises(APIError) as caught:
            self.service.register(self.account_input(name='   '))

        assert caught.value.status == 422
        self.passwords.hash.assert_not_called()

    def test_a_malformed_email_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.register(self.account_input(email='not-an-email'))

        assert caught.value.status == 422


    def test_signing_in_stores_only_the_hash_of_the_token(self):
        session = self.service.login('ADA@example.com', PASSWORD)

        token_hash, user_id, _expires = self.users.insert_token.call_args.args
        assert token_hash == hash_token(session['accessToken']) != session['accessToken']
        assert user_id == self.ada.id
        self.users.user_by_email.assert_called_once_with('ada@example.com')

    def test_a_wrong_password_is_unauthorized(self):
        self.passwords.verify.side_effect = VerifyMismatchError()

        with pytest.raises(APIError) as caught:
            self.service.login('ada@example.com', 'wrong')

        assert caught.value.status == 401
        self.users.insert_token.assert_not_called()

    def test_an_unknown_email_gets_the_same_unauthorized_answer(self):
        self.users.user_by_email.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.login('nobody@example.com', PASSWORD)

        assert (caught.value.status, caught.value.message) == (401, 'Invalid credentials')
        self.passwords.verify.assert_not_called()


    def test_a_valid_token_authenticates_its_account(self):
        expires = datetime.now(timezone.utc) + timedelta(days=1)
        self.users.token.return_value = MagicMock(user_id=self.ada.id, expires_at=expires)

        assert self.service.authenticate('secret') == str(self.ada.id)
        self.users.token.assert_called_once_with(hash_token('secret'))

    def test_an_expired_token_is_unauthorized(self):
        expired = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.users.token.return_value = MagicMock(user_id=self.ada.id, expires_at=expired)

        with pytest.raises(APIError) as caught:
            self.service.authenticate('secret')

        assert caught.value.status == 401

    def test_an_unknown_token_is_unauthorized(self):
        self.users.token.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.authenticate('secret')

        assert caught.value.status == 401

    def test_signing_out_deletes_the_token_by_its_hash(self):
        self.service.logout('secret')

        self.users.delete_token.assert_called_once_with(hash_token('secret'))


    def test_renaming_trims_the_name(self):
        self.service.rename_me(str(self.ada.id), '  Ada L  ')

        self.users.rename.assert_called_once_with(self.ada.id, 'Ada L')

    def test_renaming_to_a_blank_name_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.service.rename_me(str(uuid4()), ' ')

        assert caught.value.status == 422
