import pytest

from helpers import client_for, create_group, expense, headers, join, m, register


class TestGroupLifecycle:
    @pytest.fixture(autouse=True)
    def setup(self, database) -> None:
        self.api = client_for(database)
        self.ada = register(self.api, 'ada@example.com', 'Ada')
        self.sam = register(self.api, 'sam@example.com', 'Sam')
        self.group = create_group(self.api, self.ada)
        join(self.api, self.group, self.ada, self.sam)
        self.gid = self.group['id']

    def call(self, who, method, path='', **kwargs):
        return getattr(self.api, method)(f'/v1/groups/{self.gid}{path}', headers=headers(who), **kwargs)

    def spend(self, who, amount=2000):
        body = expense(self.group, m(who, self.group), [m(self.ada, self.group), m(self.sam, self.group)], amount=amount)
        response = self.api.put(f"/v1/groups/{self.gid}/expenses/{body['id']}", headers=headers(who), json=body)
        assert response.status_code == 200, response.text

    def snapshot(self, who):
        return self.call(who, 'get').json()

    def settle_up(self):
        payment = {'id': '00000000-0000-4000-8000-000000000001', 'fromID': m(self.sam, self.group), 'toID': m(self.ada, self.group), 'amountMinor': 1000}
        assert self.call(self.sam, 'post', '/settlements', json=payment).status_code == 201

    def test_leaving_when_even_removes_you_from_the_list_and_tells_you_later(self):
        assert self.call(self.sam, 'post', '/leave').status_code == 204

        listed = {g['id']: g for g in self.api.get('/v1/groups', headers=headers(self.sam)).json()}
        assert listed[self.gid]['status'] == 'removed' and 'members' not in listed[self.gid]
        assert self.call(self.sam, 'get').status_code == 404
        assert self.call(self.sam, 'post', '/archive').status_code == 404
        member = next(x for x in self.snapshot(self.ada)['members'] if x['id'] == m(self.sam, self.group))
        assert member['removedAt'] is not None

    def test_leaving_while_owed_or_owing_is_refused_with_the_amount(self):
        self.spend(self.ada)

        mine = self.call(self.ada, 'post', '/leave').json()
        theirs = self.call(self.sam, 'post', '/leave')

        assert (mine['code'], mine['balanceMinor']) == ('owes_balance', 1000)
        assert (theirs.status_code, theirs.json()['balanceMinor']) == (409, -1000)
        assert self.call(self.sam, 'get').status_code == 200

    def test_the_owner_leaving_passes_the_group_on_and_a_lone_owner_cannot_leave(self):
        assert self.call(self.ada, 'post', '/leave').status_code == 204
        assert self.snapshot(self.sam)['ownerID'] == m(self.sam, self.group)

        refused = self.call(self.sam, 'post', '/leave')
        assert (refused.status_code, refused.json()['code']) == (409, 'last_account')

    def test_the_owner_can_remove_someone_who_owes_and_their_balance_stays(self):
        self.spend(self.ada)

        assert self.call(self.ada, 'delete', f"/members/{m(self.sam, self.group)}").status_code == 204

        snapshot = self.snapshot(self.ada)
        assert {b['memberID']: b['minorUnits'] for b in snapshot['balances']}[m(self.sam, self.group)] == -1000
        assert self.call(self.sam, 'get').status_code == 404

    def test_others_cannot_remove_people_and_the_owner_cannot_remove_themselves(self):
        assert self.call(self.sam, 'delete', f"/members/{m(self.ada, self.group)}").json()['code'] == 'not_owner'
        assert self.call(self.ada, 'delete', f"/members/{m(self.ada, self.group)}").json()['code'] == 'use_leave'

    def test_an_expense_cannot_be_added_by_someone_who_left(self):
        self.call(self.sam, 'post', '/leave')
        body = expense(self.group, m(self.sam, self.group), [m(self.sam, self.group)])

        assert self.api.put(f"/v1/groups/{self.gid}/expenses/{body['id']}", headers=headers(self.sam), json=body).status_code == 404

    def test_archiving_needs_everyone_settled_and_adding_an_expense_brings_it_back(self):
        self.spend(self.ada)
        assert self.call(self.ada, 'post', '/archive').json()['code'] == 'not_settled'
        self.settle_up()

        assert self.call(self.ada, 'post', '/archive').status_code == 204
        assert self.snapshot(self.ada)['archived'] is True
        self.spend(self.sam, amount=500)

        assert self.snapshot(self.ada)['archived'] is False

    def test_archiving_can_be_undone(self):
        assert self.call(self.ada, 'post', '/archive').status_code == 204

        assert self.call(self.sam, 'post', '/unarchive').status_code == 204
        assert self.snapshot(self.sam)['archived'] is False

    def test_the_owner_deletes_a_settled_group_and_everyone_else_is_told(self):
        assert self.call(self.sam, 'delete').json()['code'] == 'not_owner'
        self.spend(self.ada)
        assert self.call(self.ada, 'delete').json()['code'] == 'not_settled'
        self.settle_up()

        assert self.call(self.ada, 'delete').status_code == 204

        for who in (self.ada, self.sam):
            listed = {g['id']: g for g in self.api.get('/v1/groups', headers=headers(who)).json()}
            assert listed[self.gid]['status'] == 'deleted' and 'members' not in listed[self.gid]
            assert self.call(who, 'get').status_code == 404
