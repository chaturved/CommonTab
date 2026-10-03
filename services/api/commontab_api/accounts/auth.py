from fastapi import HTTPException

from .repository import AccountRepository


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


def current_user(accounts: AccountRepository, authorization: str | None) -> str:
    return accounts.authenticate(bearer_token(authorization))
