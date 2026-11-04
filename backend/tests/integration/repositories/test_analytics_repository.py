import pytest

from app.repositories.analytics import AnalyticsRepository


class TestAnalyticsRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = AnalyticsRepository(connection)

    def test_the_first_event_counts_one_and_each_repeat_adds_one(self):
        for _ in range(3):
            self.repo.record('scan_opened', 'B')

        assert self.repo.counts() == [{'name': 'scan_opened', 'variant': 'B', 'count': 3}]

    def test_variants_and_names_are_counted_separately_in_order(self):
        self.repo.record('scan_opened', 'B')
        self.repo.record('scan_opened', 'A')
        self.repo.record('bill_shared', 'A')

        assert [(c['name'], c['variant']) for c in self.repo.counts()] == [
            ('bill_shared', 'A'), ('scan_opened', 'A'), ('scan_opened', 'B')]

    def test_nothing_recorded_is_an_empty_list(self):
        assert self.repo.counts() == []
