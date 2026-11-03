import json
import logging

import httpx
import pytest

from app.core.config import Settings
from app.integrations.mailer import ConsoleMailer, ResendMailer, get_mailer, reset_message, send_reset_quietly


class TestMailer:
    def resend(self, handler) -> ResendMailer:
        client = httpx.Client(transport=httpx.MockTransport(handler))
        return ResendMailer('re_secret', 'CommonTab <no-reply@example.com>', client)

    def test_the_message_names_the_code_and_says_it_lasts_an_hour(self):
        subject, text, html = reset_message('ABCD-2345')

        assert 'ABCD-2345' in text and 'ABCD-2345' in html and 'one hour' in text and subject

    def test_resend_gets_the_sender_recipient_and_a_bearer_key(self):
        seen = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen.update(url=str(request.url), auth=request.headers['authorization'], body=json.loads(request.content))
            return httpx.Response(200, json={'id': 'email-1'})

        self.resend(handler).send_password_reset('ada@example.com', 'ABCD-2345')

        assert seen['url'] == 'https://api.resend.com/emails' and seen['auth'] == 'Bearer re_secret'
        assert seen['body']['from'] == 'CommonTab <no-reply@example.com>' and seen['body']['to'] == ['ada@example.com']
        assert 'ABCD-2345' in seen['body']['text']

    def test_a_refusal_from_resend_is_an_error(self):
        mailer = self.resend(lambda request: httpx.Response(422, json={'message': 'bad from address'}))

        with pytest.raises(httpx.HTTPStatusError):
            mailer.send_password_reset('ada@example.com', 'ABCD-2345')

    def test_sending_quietly_swallows_and_logs_a_failure(self, caplog):
        mailer = self.resend(lambda request: httpx.Response(500))

        with caplog.at_level(logging.ERROR):
            send_reset_quietly(mailer, 'ada@example.com', 'ABCD-2345')

        assert 'Could not send the password reset email' in caplog.text

    def test_the_console_mailer_logs_the_code(self, caplog):
        with caplog.at_level(logging.WARNING):
            ConsoleMailer().send_password_reset('ada@example.com', 'ABCD-2345')

        assert 'ABCD-2345' in caplog.text and 'ada@example.com' in caplog.text

    @pytest.mark.parametrize('key, expected', [('re_x', ResendMailer), (None, ConsoleMailer)])
    def test_the_mailer_follows_the_settings(self, monkeypatch, key, expected):
        settings = Settings(database_url='', resend_api_key=key)
        monkeypatch.setattr('app.integrations.mailer.get_settings', lambda: settings)
        get_mailer.cache_clear()
        try:
            assert isinstance(get_mailer(), expected)
        finally:
            get_mailer.cache_clear()
