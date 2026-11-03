from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.core.db import Database
from app.repositories.analytics import AnalyticsRepository
from app.services.accounts import AccountService
from app.services.bill_sessions import BillSessionService
from app.services.groups import GroupService


@dataclass(frozen=True)
class Container:
    """The composition root: every collaborator is built here once and handed out through `api.deps`."""

    settings: Settings
    database: Database
    accounts: AccountService
    groups: GroupService
    bill_sessions: BillSessionService
    analytics: AnalyticsRepository


def build_container(database: Database, settings: Settings, bill_session_lifetime_seconds: int) -> Container:
    accounts = AccountService(database)
    return Container(
        settings=settings,
        database=database,
        accounts=accounts,
        groups=GroupService(database, accounts),
        bill_sessions=BillSessionService(database, lifetime_seconds=bill_session_lifetime_seconds),
        analytics=AnalyticsRepository(database),
    )
