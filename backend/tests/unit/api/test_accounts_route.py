from unittest.mock import MagicMock

import pytest

from app.services.accounts import AccountService
from conftest import USER_ID

PASSWORD = 'correct horse battery staple'


class TestAccountsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=AccountService)
        overrides[AccountService] = lambda: self.service

    def test_registering_is_201_and_returns_the_session(self):
        self.service.register.return_value = {'accessToken': 't'}

        response = self.client.post('/v1/accounts', json={'email': 'a@b.co', 'name': 'Ada', 'password': PASSWORD})

        assert (response.status_code, response.json()) == (201, {'accessToken': 't'})
        assert self.service.register.call_args.args[0].email == 'a@b.co'

    @pytest.mark.parametrize('changes', [{'password': 'too short'}, {'name': ''}, {'email': 'x'}])
    def test_an_invalid_sign_up_is_422(self, changes):
        body = {'email': 'a@b.co', 'name': 'Ada', 'password': PASSWORD, **changes}

        assert self.client.post('/v1/accounts', json=body).status_code == 422
        self.service.register.assert_not_called()

    def test_signing_in_passes_the_email_and_password(self):
        self.service.login.return_value = {'accessToken': 't'}

        response = self.client.post('/v1/auth/sessions', json={'email': 'a@b.co', 'password': 'pw'})

        assert response.status_code == 200
        self.service.login.assert_called_once_with('a@b.co', 'pw')

    def test_signing_out_is_204_with_no_body(self):
        response = self.client.delete('/v1/auth/sessions', headers={'Authorization': 'Bearer abc'})

        assert (response.status_code, response.content) == (204, b'')
        self.service.logout.assert_called_once_with('abc')

    @pytest.mark.parametrize('header', [None, 'abc', 'Basic abc', 'Bearer '])
    def test_signing_out_needs_a_bearer_token(self, header):
        headers = {'Authorization': header} if header else {}

        assert self.client.delete('/v1/auth/sessions', headers=headers).status_code == 401
        self.service.logout.assert_not_called()

    def test_me_returns_the_signed_in_account(self):
        self.service.me.return_value = {'id': USER_ID}

        assert self.client.get('/v1/me').json() == {'id': USER_ID}
        self.service.me.assert_called_once_with(USER_ID)

    def test_updating_the_profile_passes_the_new_name(self):
        self.service.rename_me.return_value = {'id': USER_ID}

        self.client.patch('/v1/me', json={'name': 'Ada L'})

        self.service.rename_me.assert_called_once_with(USER_ID, 'Ada L')
