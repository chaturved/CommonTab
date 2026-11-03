from __future__ import annotations

import logging
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)
RESEND_URL = 'https://api.resend.com/emails'


class Mailer(Protocol):
    def send_password_reset(self, to: str, code: str) -> None: ...


def reset_message(code: str) -> tuple[str, str, str]:
    """(subject, plain text, html) of the password reset email."""
    subject = 'Your CommonTab reset code'
    text = (f'Your CommonTab password reset code is {code}.\n\nIt works for one hour. If you did not ask to reset '
            'your password, you can ignore this email: nothing changes.')
    html = (f'<p>Your CommonTab password reset code is</p><p style="font-size:24px;letter-spacing:2px">'
            f'<strong>{code}</strong></p><p>It works for one hour. If you did not ask to reset your password, '
            'you can ignore this email: nothing changes.</p>')
    return subject, text, html


class ResendMailer:
    """Sends through Resend's HTTP API."""

    def __init__(self, api_key: str, sender: str, client: httpx.Client | None = None):
        self.api_key = api_key
        self.sender = sender
        self.client = client or httpx.Client(timeout=10)

    def send_password_reset(self, to: str, code: str) -> None:
        subject, text, html = reset_message(code)
        response = self.client.post(RESEND_URL, headers={'Authorization': f'Bearer {self.api_key}'},
                                    json={'from': self.sender, 'to': [to], 'subject': subject, 'text': text, 'html': html})
        response.raise_for_status()


class ConsoleMailer:
    """For development without a Resend key: the code goes to the log instead of an inbox."""

    def send_password_reset(self, to: str, code: str) -> None:
        log.warning('RESEND_API_KEY is not set, so no email was sent. Password reset code for %s: %s', to, code)


@lru_cache
def get_mailer() -> Mailer:
    settings = get_settings()
    if settings.resend_api_key:
        return ResendMailer(settings.resend_api_key, settings.mail_from)
    return ConsoleMailer()


def send_reset_quietly(mailer: Mailer, to: str, code: str) -> None:
    """Runs after the response: the answer to "forgot password" is the same whether or not the email went out."""
    try:
        mailer.send_password_reset(to, code)
    except Exception:  # noqa: BLE001 - a mail outage must not become a 500 that tells whether the account exists
        log.exception('Could not send the password reset email')
