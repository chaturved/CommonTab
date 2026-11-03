from unittest.mock import MagicMock

import pytest

from app.core.db import Database, get_database


class TestHealthRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.database = MagicMock(spec_set=Database)
        overrides[get_database] = lambda: self.database

    @pytest.mark.parametrize('path', ['/healthz', '/health'])
    def test_200_when_the_database_answers(self, path):
        response = self.client.get(path)

        assert (response.status_code, response.json()) == (200, {'status': 'ok'})

    def test_503_without_details_when_it_does_not(self):
        self.database.ping.side_effect = RuntimeError('password=hunter2 refused')

        response = self.client.get('/healthz')

        assert (response.status_code, response.json()) == (503, {'status': 'unavailable'})
