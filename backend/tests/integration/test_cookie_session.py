from app.core.config import CLIENT_HEADER, SESSION_COOKIE
from helpers import client_for, register


class TestCookieSession:
    def test_signing_up_logs_the_browser_in_without_any_header(self, database):
        api = client_for(database, cookie_secure=False)  # the test client talks plain http
        register(api, 'ada@example.com', 'Ada')

        assert api.get('/v1/me').json()['email'] == 'ada@example.com'

    def test_a_cookie_write_needs_the_client_header_and_a_bearer_write_does_not(self, database):
        api = client_for(database, cookie_secure=False)
        account = register(api, 'ada@example.com', 'Ada')

        assert api.patch('/v1/me', json={'name': 'Ada L'}).status_code == 403
        assert api.patch('/v1/me', json={'name': 'Ada L'}, headers={CLIENT_HEADER: '1'}).json()['name'] == 'Ada L'
        bearer_only = client_for(database)
        assert bearer_only.patch('/v1/me', json={'name': 'Ada M'},
                                 headers={'Authorization': f"Bearer {account['accessToken']}"}).json()['name'] == 'Ada M'

    def test_signing_out_revokes_the_token_and_clears_the_cookie(self, database):
        api = client_for(database, cookie_secure=False)
        account = register(api, 'ada@example.com', 'Ada')

        assert api.delete('/v1/auth/sessions', headers={CLIENT_HEADER: '1'}).status_code == 204

        assert SESSION_COOKIE not in api.cookies
        assert api.get('/v1/me').status_code == 401
        assert client_for(database).get('/v1/me', headers={'Authorization': f"Bearer {account['accessToken']}"}
                                        ).status_code == 401

    def test_signing_in_again_sets_a_fresh_cookie(self, database):
        api = client_for(database, cookie_secure=False)
        register(api, 'ada@example.com', 'Ada')
        api.cookies.clear()
        assert api.get('/v1/me').status_code == 401

        api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': 'correct horse battery staple'})

        assert api.get('/v1/me').status_code == 200
