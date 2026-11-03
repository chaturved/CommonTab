from app.core.config import load_settings
from app.core.ratelimit import SlidingWindow
from helpers import client_for, headers, register


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_sliding_window_allows_the_limit_then_says_how_long_to_wait():
    clock = Clock()
    window = SlidingWindow(3, 60, clock)
    assert [window.check('a') for _ in range(3)] == [0.0, 0.0, 0.0]
    wait = window.check('a')
    assert 59 <= wait <= 60
    assert window.check('b') == 0.0  # other keys are separate
    clock.now += 61
    assert window.check('a') == 0.0  # the window moved on


def test_settings_read_limits_from_the_environment(tmp_path):
    env = {'DATABASE_URL': 'postgresql://u:p@h/db', 'RATE_LIMIT_AUTH_PER_MINUTE': '3', 'RATE_LIMIT_PER_MINUTE': '50',
           'TRUST_PROXY': 'true'}
    settings = load_settings(env, tmp_path / 'none.env')
    assert (settings.rate_limit_auth_per_minute, settings.rate_limit_per_minute, settings.trust_proxy) == (3, 50, True)
    defaults = load_settings({'DATABASE_URL': 'postgresql://u:p@h/db'}, tmp_path / 'none.env')
    assert (defaults.rate_limit_auth_per_minute, defaults.rate_limit_per_minute, defaults.trust_proxy) == (10, 600, False)


def app_with(database, **limits):
    return client_for(database, **limits)


def test_sign_in_attempts_are_limited_per_ip(database):
    api = app_with(database, rate_limit_auth_per_minute=3)
    for _ in range(3):
        assert api.post('/v1/auth/sessions', json={'email': 'x@example.com', 'password': 'wrong'}).status_code == 401
    blocked = api.post('/v1/auth/sessions', json={'email': 'x@example.com', 'password': 'wrong'})
    assert blocked.status_code == 429
    assert blocked.json()['code'] == 'rate_limited'
    assert int(blocked.headers['retry-after']) >= 1
    assert blocked.json()['retryAfterSeconds'] == int(blocked.headers['retry-after'])


def test_sign_up_shares_the_auth_limit(database):
    api = app_with(database, rate_limit_auth_per_minute=2)
    register(api, 'a@example.com', 'A')
    register(api, 'b@example.com', 'B')
    response = api.post('/v1/accounts', json={'email': 'c@example.com', 'name': 'C', 'password': 'correct horse battery staple'})
    assert response.status_code == 429


def test_other_requests_are_limited_per_session_not_per_ip(database):
    api = app_with(database, rate_limit_per_minute=3)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    assert [api.get('/v1/me', headers=headers(ada)).status_code for _ in range(3)] == [200, 200, 200]
    assert api.get('/v1/me', headers=headers(ada)).status_code == 429
    assert api.get('/v1/me', headers=headers(bob)).status_code == 200  # same IP, different session


def test_health_checks_are_never_limited(database):
    api = app_with(database, rate_limit_per_minute=1, rate_limit_auth_per_minute=1)
    assert all(api.get('/healthz').status_code == 200 for _ in range(5))


def test_forwarded_ip_is_ignored_unless_the_proxy_is_trusted(database):
    body = {'email': 'x@example.com', 'password': 'wrong'}
    api = app_with(database, rate_limit_auth_per_minute=1)
    assert api.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'}).status_code == 401
    assert api.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'}).status_code == 429
    behind_proxy = app_with(database, rate_limit_auth_per_minute=1, trust_proxy=True)
    assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1'}).status_code == 401
    assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '2.2.2.2'}).status_code == 401
    assert behind_proxy.post('/v1/auth/sessions', json=body, headers={'X-Forwarded-For': '1.1.1.1, 9.9.9.9'}).status_code == 429
