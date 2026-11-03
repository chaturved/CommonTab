from __future__ import annotations

import hashlib
from functools import lru_cache

from argon2 import PasswordHasher


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@lru_cache
def get_password_hasher() -> PasswordHasher:
    return PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
