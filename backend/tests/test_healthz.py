from fastapi.testclient import TestClient

from app.core.db import Database, create_db_engine
from app.main import create_app


def test_healthz_is_ok_when_the_database_answers(database):
    api = TestClient(create_app(database))
    for path in ('/healthz', '/health'):
        response = api.get(path)
        assert response.status_code == 200
        assert response.json() == {'status': 'ok'}


def test_healthz_needs_no_login(database):
    assert TestClient(create_app(database)).get('/healthz', headers={}).status_code == 200


def test_healthz_is_503_when_the_database_is_unreachable():
    broken = Database(create_db_engine('postgresql+psycopg://nobody:nothing@127.0.0.1:1/none'))
    response = TestClient(create_app(broken)).get('/healthz')
    assert response.status_code == 503
    assert response.json() == {'status': 'unavailable'}  # no error details leaked
