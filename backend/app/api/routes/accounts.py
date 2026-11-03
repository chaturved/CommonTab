from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.api.deps import AccountsDep, AccountToken, CurrentUser
from app.core.config import SESSION_COOKIE, Settings, get_settings
from app.services.accounts import TOKEN_LIFETIME
from app.schemas.accounts import AccountInput, LoginInput, UpdateProfileInput

router = APIRouter(prefix='/v1')


def set_session_cookie(response: Response, session: dict, settings: Settings) -> dict:
    """Besides returning the token in the body, keep it in an httpOnly cookie for browsers (script cannot read it)."""
    response.set_cookie(SESSION_COOKIE, session['accessToken'], max_age=int(TOKEN_LIFETIME.total_seconds()),
                        httponly=True, secure=settings.cookie_secure, samesite='lax', path='/')
    return session


@router.post('/accounts', status_code=201)
def register(input: AccountInput, response: Response, accounts: AccountsDep,
             settings: Settings = Depends(get_settings)):
    return set_session_cookie(response, accounts.register(input), settings)


@router.post('/auth/sessions')
def login(input: LoginInput, response: Response, accounts: AccountsDep, settings: Settings = Depends(get_settings)):
    return set_session_cookie(response, accounts.login(input.email, input.password), settings)


@router.delete('/auth/sessions', status_code=204)
def logout(token: AccountToken, accounts: AccountsDep):
    accounts.logout(token)
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path='/')
    return response


@router.get('/me')
def me(user: CurrentUser, accounts: AccountsDep):
    return accounts.me(user)


@router.patch('/me')
def update_me(input: UpdateProfileInput, user: CurrentUser, accounts: AccountsDep):
    return accounts.rename_me(user, input.name)
