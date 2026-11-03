from __future__ import annotations

import hmac
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from fastapi import Depends

from app.core.errors import fail
from app.core.security import get_password_hasher, hash_token
from app.domain.emails import normalize_email
from app.domain.short_codes import display_code, new_code, normalize_code
from app.repositories.password_resets import PasswordResetRepository
from app.repositories.users import UserRepository

RESET_LIFETIME = timedelta(hours=1)
RESEND_INTERVAL = timedelta(seconds=60)
MAX_ATTEMPTS = 5


@dataclass(frozen=True)
class ResetEmail:
    to: str
    code: str


class PasswordResetService:
    def __init__(self, resets: PasswordResetRepository = Depends(PasswordResetRepository),
                 users: UserRepository = Depends(UserRepository),
                 passwords: PasswordHasher = Depends(get_password_hasher)):
        self.resets = resets
        self.users = users
        self.passwords = passwords

    def request(self, email: str) -> ResetEmail | None:
        user = self.users.user_by_email(normalize_email(email))
        if user is None:
            return None
        now = datetime.now(timezone.utc)
        last = self.resets.latest_created_at(user.id)
        if last is not None and now - last < RESEND_INTERVAL:
            return None
        code = new_code()
        self.resets.supersede(user.id, now)
        self.resets.insert(hash_token(code), user.id, now + RESET_LIFETIME, now)
        return ResetEmail(user.email, display_code(code))

    def confirm(self, email: str, code: str, new_password: str) -> bool:
        user = self.users.user_by_email(normalize_email(email))
        if user is None:
            return False
        now = datetime.now(timezone.utc)
        active = self.resets.active(user.id)
        if active is None or active.expires_at <= now:
            return False
        normalized = normalize_code(code)
        if normalized is None or not hmac.compare_digest(active.code_hash, hash_token(normalized)):
            if self.resets.record_failed_attempt(active.code_hash) >= MAX_ATTEMPTS:
                self.resets.mark_used(active.code_hash, now)
            return False
        self.users.set_password(user.id, self.passwords.hash(new_password))
        self.users.delete_tokens_for_user(user.id)
        self.resets.mark_used(active.code_hash, now)
        return True
