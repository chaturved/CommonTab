from __future__ import annotations

from dataclasses import dataclass

from argon2 import PasswordHasher

from app.core.config import Settings
from app.core.db import Database
from app.repositories.unit_of_work import unit_of_work_factory
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


@dataclass(frozen=True)
class Container:
    """The composition root: every collaborator is built here once and handed out through `api.deps`."""

    settings: Settings
    database: Database
    accounts: AccountService
    groups: GroupService
    invitations: InvitationService
    expenses: ExpenseService
    settlements: SettlementService
    receipts: ReceiptService
    bill_sessions: BillSessionService
    analytics: AnalyticsService


def build_container(database: Database, settings: Settings, bill_session_lifetime_seconds: int) -> Container:
    uow = unit_of_work_factory(database)
    snapshots = SnapshotBuilder()
    return Container(
        settings=settings,
        database=database,
        accounts=AccountService(uow, PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)),
        groups=GroupService(uow, snapshots),
        invitations=InvitationService(uow, snapshots),
        expenses=ExpenseService(uow),
        settlements=SettlementService(uow, snapshots),
        receipts=ReceiptService(uow, ReceiptImageProcessor()),
        bill_sessions=BillSessionService(uow, lifetime_seconds=bill_session_lifetime_seconds),
        analytics=AnalyticsService(uow),
    )
