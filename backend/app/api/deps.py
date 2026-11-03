from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from app.container import Container
from app.repositories.analytics import AnalyticsRepository
from app.services.accounts import AccountService
from app.services.bill_sessions import BillSessionService
from app.services.groups import GroupService


def get_container(request: Request) -> Container:
    return request.app.state.container


ContainerDep = Annotated[Container, Depends(get_container)]


def get_accounts(container: ContainerDep) -> AccountService:
    return container.accounts


def get_groups(container: ContainerDep) -> GroupService:
    return container.groups


def get_bill_sessions(container: ContainerDep) -> BillSessionService:
    return container.bill_sessions


def get_analytics(container: ContainerDep) -> AnalyticsRepository:
    return container.analytics


AccountsDep = Annotated[AccountService, Depends(get_accounts)]
GroupsDep = Annotated[GroupService, Depends(get_groups)]
BillSessionsDep = Annotated[BillSessionService, Depends(get_bill_sessions)]
AnalyticsDep = Annotated[AnalyticsRepository, Depends(get_analytics)]


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


Token = Annotated[str, Depends(bearer_token)]


def current_user(token: Token, accounts: AccountsDep) -> str:
    """The id of the signed-in account, or 401."""
    return accounts.authenticate(token)


CurrentUser = Annotated[str, Depends(current_user)]
