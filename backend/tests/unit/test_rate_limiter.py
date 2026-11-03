from app.core.config import load_settings
from app.core.ratelimit import SlidingWindow


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class TestRateLimiter:
    def test_sliding_window_allows_the_limit_then_says_how_long_to_wait(self):
        clock = Clock()
        window = SlidingWindow(3, 60, clock)
        assert [window.check('a') for _ in range(3)] == [0.0, 0.0, 0.0]
        wait = window.check('a')
        assert 59 <= wait <= 60
        assert window.check('b') == 0.0  # other keys are separate
        clock.now += 61
        assert window.check('a') == 0.0  # the window moved on

    def test_settings_read_limits_from_the_environment(self, tmp_path):
        env = {'DATABASE_URL': 'postgresql://u:p@h/db', 'RATE_LIMIT_AUTH_PER_MINUTE': '3', 'RATE_LIMIT_PER_MINUTE': '50',
               'TRUST_PROXY': 'true'}
        settings = load_settings(env, tmp_path / 'none.env')
        assert (settings.rate_limit_auth_per_minute, settings.rate_limit_per_minute, settings.trust_proxy) == (3, 50, True)
        defaults = load_settings({'DATABASE_URL': 'postgresql://u:p@h/db'}, tmp_path / 'none.env')
        assert (defaults.rate_limit_auth_per_minute, defaults.rate_limit_per_minute, defaults.trust_proxy) == (10, 600, False)
