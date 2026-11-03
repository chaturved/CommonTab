from unittest.mock import MagicMock

import pytest

from app.services.activity import ActivityService
from conftest import USER_ID


class TestActivityRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=ActivityService)
        self.service.feed.return_value = {'events': [], 'next': 0}
        overrides[ActivityService] = lambda: self.service

    def test_the_feed_passes_the_account_the_cursor_and_the_page_size(self):
        response = self.client.get('/v1/activity?since=5&limit=20')

        assert (response.status_code, response.json()) == (200, {'events': [], 'next': 0})
        self.service.feed.assert_called_once_with(USER_ID, 5, 20)

    def test_it_starts_from_the_beginning_with_a_default_page(self):
        self.client.get('/v1/activity')

        self.service.feed.assert_called_once_with(USER_ID, 0, 200)

    @pytest.mark.parametrize('query', ['since=-1', 'limit=0', 'limit=501', 'since=abc'])
    def test_a_bad_cursor_or_page_size_is_422(self, query):
        assert self.client.get(f'/v1/activity?{query}').status_code == 422
