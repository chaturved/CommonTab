from app.core.config import DEFAULT_ALLOWED_ORIGINS, allowed_origins, load_settings, normalize_database_url, read_dotenv


class TestConfig:
    def test_normalize_database_url(self):
        assert normalize_database_url('postgresql://u:p@h:5432/db') == 'postgresql+psycopg://u:p@h:5432/db'
        assert normalize_database_url('postgres://u:p@h/db') == 'postgresql+psycopg://u:p@h/db'
        assert normalize_database_url('postgresql+psycopg://u@h/db') == 'postgresql+psycopg://u@h/db'

    def test_read_dotenv(self, tmp_path):
        path = tmp_path / '.env'
        path.write_text('# comment\nA=1\nB = "two"\n\nC=x=y\n')
        assert read_dotenv(path) == {'A': '1', 'B': 'two', 'C': 'x=y'}
        assert read_dotenv(tmp_path / 'missing') == {}

    def test_allowed_origins_come_from_the_environment_or_default_to_the_expo_dev_servers(self, tmp_path):
        none = tmp_path / 'none.env'

        assert allowed_origins({'ALLOWED_ORIGINS': ' https://app.example.com, https://b.example.com ,'}, none) == (
            'https://app.example.com', 'https://b.example.com')
        assert allowed_origins({}, none) == DEFAULT_ALLOWED_ORIGINS

    def test_the_session_cookie_is_secure_unless_switched_off(self, tmp_path):
        env = {'DATABASE_URL': 'postgresql://u:p@h/db'}
        none = tmp_path / 'none.env'

        assert load_settings(env, none).cookie_secure is True
        assert load_settings({**env, 'COOKIE_SECURE': 'false'}, none).cookie_secure is False
