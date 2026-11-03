from __future__ import annotations

from typing import Annotated, Iterator

from argon2 import PasswordHasher
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import Connection

from app.core.config import Settings
from app.core.db import Database
from app.repositories.analytics import AnalyticsRepository
from app.repositories.bill_sessions import BillSessionRepository
from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.invitations import InvitationRepository
from app.repositories.members import MemberRepository
from app.repositories.receipts import ReceiptRepository
from app.repositories.settlements import SettlementRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.accounts import AccountService
from app.services.analytics import AnalyticsService
from app.services.bill_sessions import BillSessionService
from app.services.expenses import ExpenseService
from app.services.groups import GroupService
from app.services.invitations import InvitationService
from app.services.receipt_images import ReceiptImageProcessor
from app.services.receipts import ReceiptService
from app.services.settlements import SettlementService
from app.services.snapshots import SnapshotBuilder

# --- application-wide objects, created once in create_app -------------------------------------------


def get_database(request: Request) -> Database:
    return request.app.state.database


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_password_hasher(request: Request) -> PasswordHasher:
    return request.app.state.password_hasher


DatabaseDep = Annotated[Database, Depends(get_database)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


# --- one database transaction per request --------------------------------------------------------------


def get_db(database: DatabaseDep) -> Iterator[Connection]:
    """
    A connection inside one transaction: committed when the request handler returns, rolled back if it raises.
    `scope='function'` below makes FastAPI run this cleanup before the response is sent, so a client can never
    see a response for a write that has not been committed yet.
    """
    with database.transaction() as connection:
        yield connection


Db = Annotated[Connection, Depends(get_db, scope='function')]


# --- repositories: SQL only, all sharing the request's connection ---------------------------------------


def get_users(db: Db) -> UserRepository:
    return UserRepository(db)


def get_groups_repo(db: Db) -> GroupRepository:
    return GroupRepository(db)


def get_members_repo(db: Db) -> MemberRepository:
    return MemberRepository(db)


def get_invitations_repo(db: Db) -> InvitationRepository:
    return InvitationRepository(db)


def get_expenses_repo(db: Db) -> ExpenseRepository:
    return ExpenseRepository(db)


def get_settlements_repo(db: Db) -> SettlementRepository:
    return SettlementRepository(db)


def get_receipts_repo(db: Db) -> ReceiptRepository:
    return ReceiptRepository(db)


def get_bill_sessions_repo(db: Db) -> BillSessionRepository:
    return BillSessionRepository(db)


def get_analytics_repo(db: Db) -> AnalyticsRepository:
    return AnalyticsRepository(db)


Users = Annotated[UserRepository, Depends(get_users)]
Groups = Annotated[GroupRepository, Depends(get_groups_repo)]
Members = Annotated[MemberRepository, Depends(get_members_repo)]
Invitations = Annotated[InvitationRepository, Depends(get_invitations_repo)]
Expenses = Annotated[ExpenseRepository, Depends(get_expenses_repo)]
Settlements = Annotated[SettlementRepository, Depends(get_settlements_repo)]
Receipts = Annotated[ReceiptRepository, Depends(get_receipts_repo)]
BillSessionStore = Annotated[BillSessionRepository, Depends(get_bill_sessions_repo)]
AnalyticsStore = Annotated[AnalyticsRepository, Depends(get_analytics_repo)]


# --- services -------------------------------------------------------------------------------------------


def get_guard(members: Members) -> MembershipGuard:
    return MembershipGuard(members)


Guard = Annotated[MembershipGuard, Depends(get_guard)]


def get_snapshots(groups: Groups, members: Members, expenses: Expenses, settlements: Settlements) -> SnapshotBuilder:
    return SnapshotBuilder(groups, members, expenses, settlements)


Snapshots = Annotated[SnapshotBuilder, Depends(get_snapshots)]


def get_accounts(users: Users, passwords: Annotated[PasswordHasher, Depends(get_password_hasher)]) -> AccountService:
    return AccountService(users, passwords)


def get_group_service(groups: Groups, members: Members, users: Users, guard: Guard,
                      snapshots: Snapshots) -> GroupService:
    return GroupService(groups, members, users, guard, snapshots)


def get_invitation_service(invitations: Invitations, members: Members, groups: Groups, users: Users, guard: Guard,
                           snapshots: Snapshots) -> InvitationService:
    return InvitationService(invitations, members, groups, users, guard, snapshots)


def get_expense_service(expenses: Expenses, members: Members, groups: Groups, guard: Guard) -> ExpenseService:
    return ExpenseService(expenses, members, groups, guard)


def get_settlement_service(settlements: Settlements, groups: Groups, guard: Guard,
                           snapshots: Snapshots) -> SettlementService:
    return SettlementService(settlements, groups, guard, snapshots)


def get_receipt_service(receipts: Receipts, groups: Groups, guard: Guard) -> ReceiptService:
    return ReceiptService(receipts, groups, guard, ReceiptImageProcessor())


def get_bill_session_service(store: BillSessionStore, request: Request) -> BillSessionService:
    return BillSessionService(store, lifetime_seconds=request.app.state.bill_session_lifetime_seconds)


def get_analytics_service(store: AnalyticsStore) -> AnalyticsService:
    return AnalyticsService(store)


AccountsDep = Annotated[AccountService, Depends(get_accounts)]
GroupsDep = Annotated[GroupService, Depends(get_group_service)]
InvitationsDep = Annotated[InvitationService, Depends(get_invitation_service)]
ExpensesDep = Annotated[ExpenseService, Depends(get_expense_service)]
SettlementsDep = Annotated[SettlementService, Depends(get_settlement_service)]
ReceiptsDep = Annotated[ReceiptService, Depends(get_receipt_service)]
BillSessionsDep = Annotated[BillSessionService, Depends(get_bill_session_service)]
AnalyticsDep = Annotated[AnalyticsService, Depends(get_analytics_service)]


# --- the signed-in account ----------------------------------------------------------------------------


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
        raise HTTPException(401, 'Bearer token required')
    return authorization[7:]


Token = Annotated[str, Depends(bearer_token)]


def current_user(token: Token, accounts: AccountsDep) -> str:
    """The id of the signed-in account, or 401."""
    return accounts.authenticate(token)


CurrentUser = Annotated[str, Depends(current_user)]
