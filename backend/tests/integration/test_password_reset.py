from unittest.mock import MagicMock

import pytest
from sqlalchemy import text

from app.integrations.mailer import Mailer, get_mailer
from app.main import app
from app.services.password_resets import MAX_ATTEMPTS
from helpers import client_for, headers, register

OLD = 'correct horse battery staple'
NEW = 'a brand new passphrase'


class TestPasswordReset:
    @pytest.fixture(autouse=True)
    def setup(self, database) -> None:
        self.database = database
        self.mailer = MagicMock(spec=Mailer)
        self.api = client_for(database)
        app.dependency_overrides[get_mailer] = lambda: self.mailer
        self.ada = register(self.api, 'ada@example.com', 'Ada')

    def ask(self, email='ada@example.com'):
        return self.api.post('/v1/auth/password-reset', json={'email': email})

    def confirm(self, code, password=NEW, email='ada@example.com'):
        return self.api.post('/v1/auth/password-reset/confirm',
                             json={'email': email, 'code': code, 'newPassword': password})

    def sent_code(self) -> str:
        return self.mailer.send_password_reset.call_args.args[1]

    def sign_in(self, password):
        return self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': password})

    def forget_the_last_request(self):
        with self.database.transaction() as connection:
            connection.execute(text("UPDATE password_resets SET created_at = created_at - interval '2 minutes'"))

    def test_the_whole_flow_changes_the_password_and_ends_old_sessions(self):
        assert self.ask().status_code == 202
        code = self.sent_code()

        assert self.confirm(code.lower()).status_code == 204

        assert self.sign_in(NEW).status_code == 200
        assert self.sign_in(OLD).status_code == 401
        assert client_for(self.database).get('/v1/me', headers=headers(self.ada)).status_code == 401

    def test_a_code_works_once(self):
        self.ask()
        code = self.sent_code()
        self.confirm(code)

        assert self.confirm(code, 'another new passphrase').status_code == 400
        assert self.sign_in(NEW).status_code == 200

    def test_an_unknown_email_gets_the_same_answer_and_no_email(self):
        known, unknown = self.ask(), self.ask('nobody@example.com')

        assert (known.status_code, known.json()) == (unknown.status_code, unknown.json()) == (202, {})
        assert self.mailer.send_password_reset.call_count == 1

    def test_asking_twice_in_a_minute_sends_one_email(self):
        self.ask()
        self.ask()

        assert self.mailer.send_password_reset.call_count == 1

    def test_a_second_request_makes_the_first_code_useless(self):
        self.ask()
        first = self.sent_code()
        self.forget_the_last_request()
        self.ask()
        second = self.sent_code()

        assert self.confirm(first).status_code == 400
        assert self.confirm(second).status_code == 204

    def test_wrong_guesses_burn_the_code_even_for_the_right_one_afterwards(self):
        self.ask()
        code = self.sent_code()

        wrong = [self.confirm('ZZZZ-ZZZZ').status_code for _ in range(MAX_ATTEMPTS)]

        assert wrong == [400] * MAX_ATTEMPTS
        assert self.confirm(code).status_code == 400
        assert self.sign_in(OLD).status_code == 200

    def test_an_expired_code_is_refused(self):
        self.ask()
        code = self.sent_code()
        with self.database.transaction() as connection:
            connection.execute(text("UPDATE password_resets SET expires_at = now() - interval '1 second'"))

        assert self.confirm(code).status_code == 400

    def test_a_code_does_not_work_for_another_email(self):
        register(self.api, 'bob@example.com', 'Bob')
        self.ask()

        assert self.confirm(self.sent_code(), email='bob@example.com').status_code == 400

    def test_a_weak_new_password_is_refused_without_using_the_code(self):
        self.ask()
        code = self.sent_code()

        assert self.confirm(code, 'short').status_code == 422
        assert self.confirm(code).status_code == 204
