from __future__ import annotations

from app.repositories.analytics import AnalyticsRepository



class AnalyticsService:
    def __init__(self, analytics: AnalyticsRepository):
        self.analytics = analytics

    def record(self, name: str, variant: str) -> None:
        self.analytics.record(name, variant)

    def counts(self) -> list[dict]:
        return self.analytics.counts()
