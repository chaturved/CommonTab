import pytest

from helpers import client_for, create_group, expense, headers, join, m, register

PASSWORD = 'correct horse battery staple'
NEW = 'a brand new passphrase'


class TestChangingThePassword:
    @pytest.fixture(autouse=True)
    def setup(self, database) -> None:
        self.api = client_for(database)
        self.ada = register(self.api, 'ada@example.com', 'Ada')
        self.other_device = self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': PASSWORD}).json()

    def change(self, current=PASSWORD, new=NEW):
        return self.api.post('/v1/me/password', headers=headers(self.ada), json={'currentPassword': current, 'newPassword': new})

    def test_the_new_password_works_the_old_does_not_and_other_devices_are_signed_out(self):
        assert self.change().status_code == 204

        assert self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': NEW}).status_code == 200
        assert self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': PASSWORD}).status_code == 401
        assert self.api.get('/v1/me', headers=headers(self.ada)).status_code == 200
        assert self.api.get('/v1/me', headers=headers(self.other_device)).status_code == 401

    def test_a_wrong_current_password_is_403_not_401_so_the_app_does_not_think_the_session_ended(self):
        response = self.change(current='not my password')

        assert (response.status_code, response.json()['code']) == (403, 'wrong_password')
        assert self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': PASSWORD}).status_code == 200

    def test_a_new_password_under_15_characters_is_refused(self):
        assert self.change(new='too short').status_code == 422


class TestDeletingTheAccount:
    @pytest.fixture(autouse=True)
    def setup(self, database) -> None:
        self.api = client_for(database)
        self.ada = register(self.api, 'ada@example.com', 'Ada')
        self.sam = register(self.api, 'sam@example.com', 'Sam')

    def delete(self, account, password=PASSWORD):
        return self.api.post('/v1/me/delete', headers=headers(account), json={'password': password})

    def test_a_wrong_password_deletes_nothing(self):
        response = self.delete(self.ada, 'nope')

        assert (response.status_code, response.json()['code']) == (403, 'wrong_password')
        assert self.api.get('/v1/me', headers=headers(self.ada)).status_code == 200

    def test_the_account_is_gone_and_cannot_sign_in(self):
        assert self.delete(self.ada).status_code == 204

        assert self.api.get('/v1/me', headers=headers(self.ada)).status_code == 401
        assert self.api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': PASSWORD}).status_code == 401

    def test_the_email_can_be_used_again_for_a_new_account(self):
        self.delete(self.ada)

        assert register(self.api, 'ada@example.com', 'Ada again')['user']['name'] == 'Ada again'

    def test_a_group_with_nobody_else_is_deleted_with_its_data(self):
        group = create_group(self.api, self.ada)
        self.api.put(f"/v1/groups/{group['id']}/expenses/{expense(group, m(self.ada, group), [m(self.ada, group)])['id']}",
                     headers=headers(self.ada), json=expense(group, m(self.ada, group), [m(self.ada, group)]))

        self.delete(self.ada)

        assert self.api.get(f"/v1/groups/{group['id']}", headers=headers(self.sam)).status_code == 404

    def test_a_shared_group_keeps_everything_and_the_person_stays_by_name(self):
        group = create_group(self.api, self.ada)
        join(self.api, group, self.ada, self.sam)
        spend = expense(group, m(self.ada, group), [m(self.ada, group), m(self.sam, group)], amount=2000)
        assert self.api.put(f"/v1/groups/{group['id']}/expenses/{spend['id']}", headers=headers(self.ada), json=spend).status_code == 200

        assert self.delete(self.ada).status_code == 204

        snapshot = self.api.get(f"/v1/groups/{group['id']}", headers=headers(self.sam)).json()
        people = {member['id']: member for member in snapshot['members']}
        ada = people[m(self.ada, group)]
        assert (ada['name'], ada['userID'], ada['email']) == ('Ada', None, None)
        assert snapshot['ownerID'] == m(self.sam, group)
        assert {b['memberID']: b['minorUnits'] for b in snapshot['balances']} == {m(self.ada, group): 1000, m(self.sam, group): -1000}
