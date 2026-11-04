from __future__ import annotations

from app.core.errors import fail


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or email.count('@') != 1 or not email.split('@')[0] or '.' not in email.split('@')[1]:
        fail(422, 'Invalid email address')
    return email
