from sqlalchemy import text

from app.core.config import normalize_database_url, read_dotenv


def test_normalize_database_url():
    assert normalize_database_url('postgresql://u:p@h:5432/db') == 'postgresql+psycopg://u:p@h:5432/db'
    assert normalize_database_url('postgres://u:p@h/db') == 'postgresql+psycopg://u:p@h/db'
    assert normalize_database_url('postgresql+psycopg://u@h/db') == 'postgresql+psycopg://u@h/db'


def test_read_dotenv(tmp_path):
    path = tmp_path / '.env'
    path.write_text('# comment\nA=1\nB = "two"\n\nC=x=y\n')
    assert read_dotenv(path) == {'A': '1', 'B': 'two', 'C': 'x=y'}
    assert read_dotenv(tmp_path / 'missing') == {}


def test_connects_and_stays_inside_the_test_schema(database, test_schema):
    with database.transaction() as connection:
        assert connection.execute(text('SELECT current_schema()')).scalar() == test_schema
    database.ping()
