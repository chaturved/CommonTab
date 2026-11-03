from fastapi import HTTPException

from app.services.accounts import AccountService


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


def current_user(accounts: AccountService, authorization: str | None) -> str:
    return accounts.authenticate(bearer_token(authorization))
