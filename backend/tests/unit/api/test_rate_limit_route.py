from unittest.mock import MagicMock

import pytest

from app.core.config import Settings
from app.core.db import Database, get_database
from app.core.ratelimit import RateLimiters, get_rate_limiters
from app.services.accounts import AccountService
from app.services.invitations import InvitationService

PASSWORD = 'correct horse battery staple'


class TestRateLimitRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.overrides = overrides
        self.accounts = MagicMock(spec_set=AccountService)
        overrides[AccountService] = lambda: self.accounts

    def limit(self, **settings) -> None:
        limiters = RateLimiters(Settings(database_url='', **settings))
        self.overrides[get_rate_limiters] = lambda: limiters

    def test_requests_past_the_limit_get_429_with_retry_after(self):
        self.limit(rate_limit_per_minute=2)

        statuses = [self.client.get('/v1/me').status_code for _ in range(3)]
        blocked = self.client.get('/v1/me')

        assert statuses == [200, 200, 429]
        assert blocked.json()['code'] == 'rate_limited'
        assert int(blocked.headers['retry-after']) == blocked.json()['retryAfterSeconds'] >= 1

    def test_a_blocked_request_never_reaches_the_service(self):
        self.limit(rate_limit_per_minute=1)
        self.client.get('/v1/me')
        self.accounts.me.reset_mock()

        self.client.get('/v1/me')

        self.accounts.me.assert_not_called()

    def test_sign_in_has_its_own_stricter_limit_per_ip(self):
        self.limit(rate_limit_auth_per_minute=2)
        self.accounts.login.return_value = {'accessToken': 'tok'}

        statuses = [self.client.post('/v1/auth/sessions', json={'email': 'a@b.co', 'password': 'pw'}).status_code
                    for _ in range(3)]

        assert statuses == [200, 200, 429]

    def test_other_requests_are_counted_per_bearer_token(self):
        self.limit(rate_limit_per_minute=1)

        first = self.client.get('/v1/me', headers={'Authorization': 'Bearer one'})
        second = self.client.get('/v1/me', headers={'Authorization': 'Bearer two'})
        again = self.client.get('/v1/me', headers={'Authorization': 'Bearer one'})

        assert (first.status_code, second.status_code, again.status_code) == (200, 200, 429)

    def test_health_checks_are_never_limited(self):
        self.limit(rate_limit_per_minute=1, rate_limit_auth_per_minute=1)
        self.overrides[get_database] = lambda: MagicMock(spec_set=Database)

        assert all(self.client.get('/healthz').status_code == 200 for _ in range(5))

    def test_the_forwarded_address_counts_only_when_the_proxy_is_trusted(self):
        self.limit(rate_limit_auth_per_minute=1)
        self.accounts.login.return_value = {'accessToken': 'tok'}
        body = {'email': 'a@b.co', 'password': 'pw'}

        first = self.client.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'})
        other = self.client.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'})

        assert (first.status_code, other.status_code) == (200, 429)  # ignored: both are the test client's address

        self.limit(rate_limit_auth_per_minute=1, trust_proxy=True)

        first = self.client.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'})
        other = self.client.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'})

        assert (first.status_code, other.status_code) == (200, 200)

    def test_guessing_codes_is_limited_like_signing_in(self):
        self.limit(rate_limit_auth_per_minute=2)
        invitations = MagicMock(spec_set=InvitationService)
        self.overrides[InvitationService] = lambda: invitations

        statuses = [self.client.post('/v1/invitations/join', json={'code': 'ABCD-2345'}).status_code for _ in range(3)]

        assert statuses == [200, 200, 429]
