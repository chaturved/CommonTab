from unittest.mock import MagicMock

import pytest

from app.api.deps import current_user
from app.core.config import CLIENT_HEADER, SESSION_COOKIE, Settings, get_settings
from app.services.accounts import AccountService
from conftest import USER_ID

PASSWORD = 'correct horse battery staple'
SIGN_UP = {'email': 'a@b.co', 'name': 'Ada', 'password': PASSWORD}


class TestSessionCookieRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.overrides = overrides
        self.accounts = MagicMock(spec_set=AccountService)
        self.accounts.register.return_value = {'accessToken': 'tok', 'user': {'id': USER_ID}}
        self.accounts.login.return_value = {'accessToken': 'tok', 'user': {'id': USER_ID}}
        self.accounts.authenticate.return_value = USER_ID
        self.accounts.me.return_value = {'id': USER_ID}
        self.accounts.rename_me.return_value = {'id': USER_ID}
        overrides[AccountService] = lambda: self.accounts
        del overrides[current_user]

    def set_cookie(self, response) -> str:
        return response.headers['set-cookie']


    @pytest.mark.parametrize('path, body', [('/v1/accounts', SIGN_UP), ('/v1/auth/sessions', {'email': 'a@b.co', 'password': 'pw'})])
    def test_signing_up_or_in_sets_an_httponly_cookie_and_still_returns_the_token(self, path, body):
        response = self.client.post(path, json=body)

        cookie = self.set_cookie(response)
        assert response.json()['accessToken'] == 'tok'
        assert cookie.startswith(f'{SESSION_COOKIE}=tok')
        assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=lax' in cookie
        assert f'Max-Age={30 * 24 * 3600}' in cookie and 'Path=/' in cookie

    def test_the_secure_flag_can_be_turned_off_for_local_http(self):
        local = Settings(database_url='', cookie_secure=False)
        self.overrides[get_settings] = lambda: local

        cookie = self.set_cookie(self.client.post('/v1/auth/sessions', json={'email': 'a@b.co', 'password': 'pw'}))

        assert 'Secure' not in cookie and 'HttpOnly' in cookie


    def test_signing_out_clears_the_cookie(self):
        response = self.client.delete('/v1/auth/sessions', headers={'Authorization': 'Bearer tok'})

        assert response.status_code == 204
        assert f'{SESSION_COOKIE}=""' in self.set_cookie(response) and 'Max-Age=0' in self.set_cookie(response)
        self.accounts.logout.assert_called_once_with('tok')


    def test_a_cookie_alone_signs_a_read_in(self):
        self.client.cookies.set(SESSION_COOKIE, 'cookie-token')

        response = self.client.get('/v1/me')

        assert response.status_code == 200
        self.accounts.authenticate.assert_called_once_with('cookie-token')

    def test_a_write_by_cookie_needs_the_client_header(self):
        self.client.cookies.set(SESSION_COOKIE, 'cookie-token')

        response = self.client.patch('/v1/me', json={'name': 'Ada L'})

        assert response.status_code == 403
        self.accounts.rename_me.assert_not_called()

    def test_a_write_by_cookie_with_the_client_header_goes_through(self):
        self.client.cookies.set(SESSION_COOKIE, 'cookie-token')

        response = self.client.patch('/v1/me', json={'name': 'Ada L'}, headers={CLIENT_HEADER: '1'})

        assert response.status_code == 200
        self.accounts.rename_me.assert_called_once_with(USER_ID, 'Ada L')

    def test_signing_out_by_cookie_also_needs_the_client_header(self):
        self.client.cookies.set(SESSION_COOKIE, 'cookie-token')

        assert self.client.delete('/v1/auth/sessions').status_code == 403
        self.accounts.logout.assert_not_called()


    def test_a_bearer_write_needs_no_client_header(self):
        response = self.client.patch('/v1/me', json={'name': 'Ada L'}, headers={'Authorization': 'Bearer tok'})

        assert response.status_code == 200

    def test_the_header_wins_over_the_cookie(self):
        self.client.cookies.set(SESSION_COOKIE, 'cookie-token')

        self.client.get('/v1/me', headers={'Authorization': 'Bearer header-token'})

        self.accounts.authenticate.assert_called_once_with('header-token')

    @pytest.mark.parametrize('headers', [{}, {'Authorization': 'Basic abc'}, {'Authorization': 'Bearer '}])
    def test_with_no_usable_credential_it_is_401(self, headers):
        assert self.client.get('/v1/me', headers=headers).status_code == 401
        self.accounts.authenticate.assert_not_called()
