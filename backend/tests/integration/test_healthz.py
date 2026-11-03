from app.core.db import Database, create_db_engine
from helpers import client_for


class TestHealthz:
    def test_healthz_is_ok_when_the_database_answers(self, database):
        api = client_for(database)
        for path in ('/healthz', '/health'):
            response = api.get(path)
            assert response.status_code == 200
            assert response.json() == {'status': 'ok'}

    def test_healthz_needs_no_login(self, database):
        assert client_for(database).get('/healthz', headers={}).status_code == 200

    def test_healthz_is_503_when_the_database_is_unreachable(self):
        broken = Database(create_db_engine('postgresql+psycopg://nobody:nothing@127.0.0.1:1/none'))
        response = client_for(broken).get('/healthz')
        assert response.status_code == 503
        assert response.json() == {'status': 'unavailable'}  # no error details leaked
