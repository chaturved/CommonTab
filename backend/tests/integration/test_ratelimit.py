from helpers import client_for, headers, register


def app_with(database, **limits):
    return client_for(database, **limits)


class TestRatelimit:
    def test_sign_in_attempts_are_limited_per_ip(self, database):
        api = app_with(database, rate_limit_auth_per_minute=3)
        for _ in range(3):
            assert api.post('/v1/auth/sessions', json={'email': 'x@example.com', 'password': 'wrong'}).status_code == 401
        blocked = api.post('/v1/auth/sessions', json={'email': 'x@example.com', 'password': 'wrong'})
        assert blocked.status_code == 429
        assert blocked.json()['code'] == 'rate_limited'
        assert int(blocked.headers['retry-after']) >= 1
        assert blocked.json()['retryAfterSeconds'] == int(blocked.headers['retry-after'])

    def test_sign_up_shares_the_auth_limit(self, database):
        api = app_with(database, rate_limit_auth_per_minute=2)
        register(api, 'a@example.com', 'A')
        register(api, 'b@example.com', 'B')
        response = api.post('/v1/accounts', json={'email': 'c@example.com', 'name': 'C', 'password': 'correct horse battery staple'})
        assert response.status_code == 429

    def test_other_requests_are_limited_per_session_not_per_ip(self, database):
        api = app_with(database, rate_limit_per_minute=3)
        ada = register(api, 'ada@example.com', 'Ada')
        bob = register(api, 'bob@example.com', 'Bob')
        assert [api.get('/v1/me', headers=headers(ada)).status_code for _ in range(3)] == [200, 200, 200]
        assert api.get('/v1/me', headers=headers(ada)).status_code == 429
        assert api.get('/v1/me', headers=headers(bob)).status_code == 200

    def test_health_checks_are_never_limited(self, database):
        api = app_with(database, rate_limit_per_minute=1, rate_limit_auth_per_minute=1)
        assert all(api.get('/healthz').status_code == 200 for _ in range(5))

    def test_forwarded_ip_is_ignored_unless_the_proxy_is_trusted(self, database):
        body = {'email': 'x@example.com', 'password': 'wrong'}
        api = app_with(database, rate_limit_auth_per_minute=1)
        assert api.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'}).status_code == 401
        assert api.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'}).status_code == 429
        behind_proxy = app_with(database, rate_limit_auth_per_minute=1, trust_proxy=True)
        assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'}).status_code == 401
        assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'}).status_code == 401
        assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1, 9.9.9.9'}).status_code == 429
