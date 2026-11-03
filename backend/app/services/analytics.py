from __future__ import annotations

from app.repositories.unit_of_work import UnitOfWorkFactory


class AnalyticsService:
    def __init__(self, uow: UnitOfWorkFactory):
        self.uow = uow

    def record(self, name: str, variant: str) -> None:
        with self.uow() as uow:
            uow.analytics.record(name, variant)

    def counts(self) -> list[dict]:
        with self.uow() as uow:
            return uow.analytics.counts()
