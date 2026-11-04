from unittest.mock import MagicMock

import pytest

from app.core.config import Settings, get_settings
from app.services.analytics import AnalyticsService


class TestAnalyticsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.overrides = overrides
        self.service = MagicMock(spec_set=AnalyticsService)
        overrides[AnalyticsService] = lambda: self.service
        self.configure(metrics_token='admin-secret')

    def configure(self, **settings) -> None:
        configured = Settings(database_url='', **settings)
        self.overrides[get_settings] = lambda: configured

    def test_an_event_is_accepted_with_202(self):
        response = self.client.post('/v1/events', json={'name': 'scan_opened', 'variant': 'B'})

        assert (response.status_code, response.json()) == (202, {'status': 'accepted'})
        self.service.record.assert_called_once_with('scan_opened', 'B')

    def test_an_event_name_outside_the_allowlist_is_422(self):
        assert self.client.post('/v1/events', json={'name': 'unknown', 'variant': 'B'}).status_code == 422
        self.service.record.assert_not_called()

    def test_metrics_need_a_token(self):
        assert self.client.get('/v1/metrics').status_code == 401

    def test_metrics_reject_the_wrong_token(self):
        assert self.client.get('/v1/metrics', headers={'Authorization': 'Bearer wrong'}).status_code == 403

    def test_metrics_return_the_counts_for_the_right_token(self):
        self.service.counts.return_value = [{'name': 'scan_opened', 'variant': 'B', 'count': 2}]

        response = self.client.get('/v1/metrics', headers={'Authorization': 'Bearer admin-secret'})

        assert response.json() == {'counts': [{'name': 'scan_opened', 'variant': 'B', 'count': 2}]}

    def test_metrics_are_off_when_no_token_is_configured(self):
        self.configure(metrics_token=None)

        assert self.client.get('/v1/metrics', headers={'Authorization': 'Bearer x'}).status_code == 503
