from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from app.core.config import CLIENT_HEADER, SESSION_COOKIE
from app.core.errors import APIError
from app.core.ratelimit import RateLimiters, get_rate_limiters
from app.services.accounts import AccountService
from app.services.activity import ActivityService
from app.services.analytics import AnalyticsService
from app.services.bill_sessions import BillSessionService
from app.services.expenses import ExpenseService
from app.services.groups import GroupService
from app.services.invitations import InvitationService
from app.services.password_resets import PasswordResetService
from app.services.rates import RatesService
from app.services.receipts import ReceiptService
from app.services.settlements import SettlementService

AccountsDep = Annotated[AccountService, Depends(AccountService)]
PasswordResetsDep = Annotated[PasswordResetService, Depends(PasswordResetService)]
GroupsDep = Annotated[GroupService, Depends(GroupService)]
InvitationsDep = Annotated[InvitationService, Depends(InvitationService)]
ExpensesDep = Annotated[ExpenseService, Depends(ExpenseService)]
SettlementsDep = Annotated[SettlementService, Depends(SettlementService)]
ReceiptsDep = Annotated[ReceiptService, Depends(ReceiptService)]
BillSessionsDep = Annotated[BillSessionService, Depends(BillSessionService)]
AnalyticsDep = Annotated[AnalyticsService, Depends(AnalyticsService)]
ActivityDep = Annotated[ActivityService, Depends(ActivityService)]
RatesDep = Annotated[RatesService, Depends(RatesService)]


def enforce_rate_limit(request: Request, limiters: Annotated[RateLimiters, Depends(get_rate_limiters)]) -> None:
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


def account_token(request: Request, authorization: Annotated[str | None, Header()] = None) -> str:
    """
    The account's session token: the Authorization header, or else the httpOnly session cookie. Browsers send the
    cookie on their own, so a write that authenticates by cookie must also carry the X-CommonTab-Client header,
    which a page on another site cannot add without the API's CORS approval.
    """
    if authorization:
        return bearer_token(authorization)
    cookie = request.cookies.get(SESSION_COOKIE)
    if not cookie:
        raise HTTPException(401, 'Sign in required')
    if request.method not in ('GET', 'HEAD', 'OPTIONS') and CLIENT_HEADER not in request.headers:
        raise HTTPException(403, f'{CLIENT_HEADER} header required')
    return cookie


AccountToken = Annotated[str, Depends(account_token)]


def current_user(token: AccountToken, accounts: AccountsDep) -> str:
    return accounts.authenticate(token)


CurrentUser = Annotated[str, Depends(current_user)]
