from __future__ import annotations

import hashlib


def hash_token(token: str) -> str:
    """Only the hash of an access token, invitation code or session token is ever stored."""
    return hashlib.sha256(token.encode()).hexdigest()
