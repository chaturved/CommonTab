from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from app.container import Container
from app.services.accounts import AccountService
from app.services.analytics import AnalyticsService
from app.services.bill_sessions import BillSessionService
from app.services.expenses import ExpenseService
from app.services.groups import GroupService
from app.services.invitations import InvitationService
from app.services.receipts import ReceiptService
from app.services.settlements import SettlementService


def get_container(request: Request) -> Container:
    return request.app.state.container


ContainerDep = Annotated[Container, Depends(get_container)]


def get_accounts(container: ContainerDep) -> AccountService:
    return container.accounts


def get_groups(container: ContainerDep) -> GroupService:
    return container.groups


def get_invitations(container: ContainerDep) -> InvitationService:
    return container.invitations


def get_expenses(container: ContainerDep) -> ExpenseService:
    return container.expenses


def get_settlements(container: ContainerDep) -> SettlementService:
    return container.settlements


def get_receipts(container: ContainerDep) -> ReceiptService:
    return container.receipts


def get_bill_sessions(container: ContainerDep) -> BillSessionService:
    return container.bill_sessions


def get_analytics(container: ContainerDep) -> AnalyticsService:
    return container.analytics


AccountsDep = Annotated[AccountService, Depends(get_accounts)]
GroupsDep = Annotated[GroupService, Depends(get_groups)]
InvitationsDep = Annotated[InvitationService, Depends(get_invitations)]
ExpensesDep = Annotated[ExpenseService, Depends(get_expenses)]
SettlementsDep = Annotated[SettlementService, Depends(get_settlements)]
ReceiptsDep = Annotated[ReceiptService, Depends(get_receipts)]
BillSessionsDep = Annotated[BillSessionService, Depends(get_bill_sessions)]
AnalyticsDep = Annotated[AnalyticsService, Depends(get_analytics)]


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


Token = Annotated[str, Depends(bearer_token)]


def current_user(token: Token, accounts: AccountsDep) -> str:
    """The id of the signed-in account, or 401."""
    return accounts.authenticate(token)


CurrentUser = Annotated[str, Depends(current_user)]
