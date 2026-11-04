from __future__ import annotations

from fastapi import Depends

from app.repositories.analytics import AnalyticsRepository


class AnalyticsService:
    def __init__(self, analytics: AnalyticsRepository = Depends(AnalyticsRepository)):
        self.analytics = analytics

    def record(self, name: str, variant: str) -> None:
        self.analytics.record(name, variant)

    def counts(self) -> list[dict]:
        return self.analytics.counts()
