from fastapi import APIRouter, Header, Response

from .auth import bearer_token, current_user
from .models import AccountInput, LoginInput, UpdateProfileInput
from .repository import AccountRepository


def router_for(accounts: AccountRepository) -> APIRouter:
    router = APIRouter(prefix='/v1')

    def user(authorization: str | None) -> str:
        return current_user(accounts, authorization)

    @router.post('/accounts', status_code=201)
    def register(input: AccountInput):
        return accounts.register(input)

    @router.post('/auth/sessions')
    def login(input: LoginInput):
        return accounts.login(input.email, input.password)

    @router.delete('/auth/sessions', status_code=204)
    def logout(authorization: str | None = Header(default=None)):
        accounts.logout(bearer_token(authorization))
        return Response(status_code=204)

    @router.get('/me')
    def me(authorization: str | None = Header(default=None)):
        return accounts.me(user(authorization))

    @router.patch('/me')
    def update_me(input: UpdateProfileInput, authorization: str | None = Header(default=None)):
        return accounts.rename_me(user(authorization), input.name)

    return router
