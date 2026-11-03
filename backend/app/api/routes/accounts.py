from __future__ import annotations

from fastapi import APIRouter, Response

from app.api.deps import AccountsDep, CurrentUser, Token
from app.schemas.accounts import AccountInput, LoginInput, UpdateProfileInput

router = APIRouter(prefix='/v1')


@router.post('/accounts', status_code=201)
def register(input: AccountInput, accounts: AccountsDep):
    return accounts.register(input)


@router.post('/auth/sessions')
def login(input: LoginInput, accounts: AccountsDep):
    return accounts.login(input.email, input.password)


@router.delete('/auth/sessions', status_code=204)
def logout(token: Token, accounts: AccountsDep):
    accounts.logout(token)
    return Response(status_code=204)


@router.get('/me')
def me(user: CurrentUser, accounts: AccountsDep):
    return accounts.me(user)


@router.patch('/me')
def update_me(input: UpdateProfileInput, user: CurrentUser, accounts: AccountsDep):
    return accounts.rename_me(user, input.name)
