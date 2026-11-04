from unittest.mock import MagicMock

import pytest

from app.repositories.analytics import AnalyticsRepository
from app.services.analytics import AnalyticsService


class TestAnalyticsService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.analytics = MagicMock(spec_set=AnalyticsRepository)
        self.service = AnalyticsService(self.analytics)

    def test_recording_counts_the_event_and_variant(self):
        self.service.record('scan_opened', 'B')

        self.analytics.record.assert_called_once_with('scan_opened', 'B')

    def test_counts_come_from_the_repository(self):
        self.analytics.counts.return_value = [{'name': 'scan_opened', 'variant': 'B', 'count': 2}]

        assert self.service.counts() == [{'name': 'scan_opened', 'variant': 'B', 'count': 2}]
