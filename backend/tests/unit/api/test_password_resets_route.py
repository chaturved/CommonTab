from unittest.mock import MagicMock

import pytest

from app.integrations.mailer import Mailer, get_mailer
from app.services.password_resets import PasswordResetService, ResetEmail

NEW_PASSWORD = 'a brand new passphrase'


class TestPasswordResetsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=PasswordResetService)
        self.mailer = MagicMock(spec=Mailer)
        overrides[PasswordResetService] = lambda: self.service
        overrides[get_mailer] = lambda: self.mailer

    def test_asking_for_a_code_answers_202_and_emails_it(self):
        self.service.request.return_value = ResetEmail('ada@example.com', 'ABCD-2345')

        response = self.client.post('/v1/auth/password-reset', json={'email': 'ada@example.com'})

        assert (response.status_code, response.json()) == (202, {})
        self.mailer.send_password_reset.assert_called_once_with('ada@example.com', 'ABCD-2345')

    def test_an_email_without_an_account_gets_the_identical_answer_and_no_mail(self):
        self.service.request.return_value = None

        response = self.client.post('/v1/auth/password-reset', json={'email': 'nobody@example.com'})

        assert (response.status_code, response.json()) == (202, {})
        self.mailer.send_password_reset.assert_not_called()

    def test_a_mail_outage_does_not_change_the_answer(self):
        self.service.request.return_value = ResetEmail('ada@example.com', 'ABCD-2345')
        self.mailer.send_password_reset.side_effect = RuntimeError('resend is down')

        assert self.client.post('/v1/auth/password-reset', json={'email': 'ada@example.com'}).status_code == 202

    def test_a_missing_email_is_422(self):
        assert self.client.post('/v1/auth/password-reset', json={}).status_code == 422

    def test_the_right_code_is_204(self):
        self.service.confirm.return_value = True

        response = self.client.post('/v1/auth/password-reset/confirm', json={
            'email': 'ada@example.com', 'code': 'abcd-2345', 'newPassword': NEW_PASSWORD})

        assert (response.status_code, response.content) == (204, b'')
        self.service.confirm.assert_called_once_with('ada@example.com', 'abcd-2345', NEW_PASSWORD)

    def test_a_wrong_or_expired_code_is_a_400_with_a_code_field(self):
        self.service.confirm.return_value = False

        response = self.client.post('/v1/auth/password-reset/confirm', json={
            'email': 'ada@example.com', 'code': 'ZZZZ-ZZZZ', 'newPassword': NEW_PASSWORD})

        assert response.status_code == 400
        assert response.json() == {'detail': 'That code is wrong or has expired', 'code': 'invalid_code'}

    @pytest.mark.parametrize('changes', [{'newPassword': 'too short'}, {'newPassword': 'x' * 129}, {'code': ''}])
    def test_a_weak_password_or_empty_code_is_422_and_never_reaches_the_service(self, changes):
        body = {'email': 'ada@example.com', 'code': 'ABCD-2345', 'newPassword': NEW_PASSWORD, **changes}

        assert self.client.post('/v1/auth/password-reset/confirm', json=body).status_code == 422
        self.service.confirm.assert_not_called()
