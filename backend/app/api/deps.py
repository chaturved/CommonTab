from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from app.core.errors import APIError
from app.core.ratelimit import RateLimiters, get_rate_limiters
from app.services.accounts import AccountService
from app.services.analytics import AnalyticsService
from app.services.bill_sessions import BillSessionService
from app.services.expenses import ExpenseService
from app.services.groups import GroupService
from app.services.invitations import InvitationService
from app.services.receipts import ReceiptService
from app.services.settlements import SettlementService

# Services build themselves: each declares its repositories (and they their connection) with `Depends` in __init__.
AccountsDep = Annotated[AccountService, Depends(AccountService)]
GroupsDep = Annotated[GroupService, Depends(GroupService)]
InvitationsDep = Annotated[InvitationService, Depends(InvitationService)]
ExpensesDep = Annotated[ExpenseService, Depends(ExpenseService)]
SettlementsDep = Annotated[SettlementService, Depends(SettlementService)]
ReceiptsDep = Annotated[ReceiptService, Depends(ReceiptService)]
BillSessionsDep = Annotated[BillSessionService, Depends(BillSessionService)]
AnalyticsDep = Annotated[AnalyticsService, Depends(AnalyticsService)]


def enforce_rate_limit(request: Request, limiters: Annotated[RateLimiters, Depends(get_rate_limiters)]) -> None:
    """Runs before every route, ahead of any database work."""
    wait = limiters.check(request)
    if wait:
        seconds = int(wait) + 1
        raise APIError(429, 'Too many requests. Try again shortly.', 'rate_limited', {'retryAfterSeconds': seconds},
                       headers={'Retry-After': str(seconds)})


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


Token = Annotated[str, Depends(bearer_token)]


def current_user(token: Token, accounts: AccountsDep) -> str:
    """The id of the signed-in account, or 401."""
    return accounts.authenticate(token)


CurrentUser = Annotated[str, Depends(current_user)]
