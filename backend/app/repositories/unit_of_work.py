from __future__ import annotations

from typing import Callable

from sqlalchemy import Connection

from app.core.db import Database
from app.repositories.analytics import AnalyticsRepository
from app.repositories.bill_sessions import BillSessionRepository
from app.repositories.groups import GroupRepository
from app.repositories.users import UserRepository


class UnitOfWork:
    """
    One database transaction and the repositories that share it. Services open one per operation:

        with self.uow() as uow:
            uow.groups.member_of(...)

    It commits when the block ends and rolls back if it raises. Repositories never see a transaction
    boundary, and services never pass a connection around.
    """

    users: UserRepository
    groups: GroupRepository
    bill_sessions: BillSessionRepository
    analytics: AnalyticsRepository

    def __init__(self, database: Database):
        self._database = database
        self._transaction = None

    def __enter__(self) -> UnitOfWork:
        self._transaction = self._database.transaction()
        self._attach(self._transaction.__enter__())
        return self

    def __exit__(self, exc_type, exc, traceback):
        return self._transaction.__exit__(exc_type, exc, traceback)

    def _attach(self, connection: Connection) -> None:
        self.users = UserRepository(connection)
        self.groups = GroupRepository(connection)
        self.bill_sessions = BillSessionRepository(connection)
        self.analytics = AnalyticsRepository(connection)


UnitOfWorkFactory = Callable[[], UnitOfWork]


def unit_of_work_factory(database: Database) -> UnitOfWorkFactory:
    return lambda: UnitOfWork(database)
