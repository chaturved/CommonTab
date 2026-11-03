from uuid import uuid4

from helpers import client_for, create_group, expense, headers, join, m, register


def setup(database):
    api = client_for(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    aid, bid = m(ada, group), m(bob, group)
    record = expense(group, aid, [aid, bid], amount=10000)
    url = f"/v1/groups/{group['id']}/expenses/{record['id']}"
    assert api.put(url, headers=headers(ada), json=record).status_code == 200
    return api, ada, bob, group, record, url


def snapshot(api, group, user):
    return api.get(f"/v1/groups/{group['id']}", headers=headers(user)).json()


def balances(snap):
    return {b['memberID']: b['minorUnits'] for b in snap['balances']}


class TestTombstones:
    def test_delete_leaves_a_tombstone_other_members_can_see_and_updates_balances(self, database):
        api, ada, bob, group, record, url = setup(database)
        aid, bid = m(ada, group), m(bob, group)
        before = snapshot(api, group, bob)
        assert balances(before) == {aid: 5000, bid: -5000}

        assert api.delete(url, headers=headers(ada)).status_code == 204

        after = snapshot(api, group, bob)  # another member's device
        assert after['expenses'] == []
        assert balances(after) == {aid: 0, bid: 0}
        assert after['version'] == before['version'] + 1
        [tombstone] = after['deletedExpenses']
        assert tombstone['id'] == record['id']
        assert tombstone['version'] == 2
        assert tombstone['deletedAt'].endswith('Z')
        assert tombstone['amountMinor'] == 10000  # history kept

    def test_live_expenses_have_a_null_deleted_at(self, database):
        api, ada, bob, group, record, url = setup(database)
        [live] = snapshot(api, group, ada)['expenses']
        assert live['deletedAt'] is None
        assert snapshot(api, group, ada)['deletedExpenses'] == []

    def test_delete_is_idempotent_and_ignores_the_version(self, database):
        api, ada, bob, group, record, url = setup(database)
        assert api.delete(url + '?version=99', headers=headers(ada)).status_code == 204  # stale version: delete wins
        version = snapshot(api, group, ada)['version']
        assert api.delete(url, headers=headers(ada)).status_code == 204  # a retry
        assert api.delete(url, headers=headers(bob)).status_code == 204
        assert snapshot(api, group, ada)['version'] == version  # no extra changes
        assert len(snapshot(api, group, ada)['deletedExpenses']) == 1

    def test_delete_of_an_unknown_expense_is_a_no_op_but_another_groups_expense_is_not_found(self, database):
        api, ada, bob, group, record, url = setup(database)
        assert api.delete(f"/v1/groups/{group['id']}/expenses/{uuid4()}", headers=headers(ada)).status_code == 204
        other = create_group(api, ada)
        assert api.delete(f"/v1/groups/{other['id']}/expenses/{record['id']}", headers=headers(ada)).status_code == 404
        assert len(snapshot(api, group, ada)['expenses']) == 1

    def test_edit_after_delete_conflicts_and_returns_the_tombstone(self, database):
        api, ada, bob, group, record, url = setup(database)
        api.delete(url, headers=headers(ada))
        edit = {**record, 'version': 1, 'amountMinor': 12000}  # Bob edited offline, based on version 1
        response = api.put(url, headers=headers(bob), json=edit)
        assert response.status_code == 409
        body = response.json()
        assert body['code'] == 'version_conflict'
        assert body['current']['deletedAt'] is not None
        assert body['current']['version'] == 2
        assert snapshot(api, group, bob)['expenses'] == []  # the delete won

    def test_restore_puts_the_expense_back_on_top_of_the_tombstone(self, database):
        api, ada, bob, group, record, url = setup(database)
        aid, bid = m(ada, group), m(bob, group)
        api.delete(url, headers=headers(ada))
        restore = {**record, 'version': 2, 'amountMinor': 12000}  # tombstone version, Bob's edited content
        response = api.put(url, headers=headers(bob), json=restore)
        assert response.status_code == 200, response.text
        assert response.json()['deletedAt'] is None
        assert response.json()['version'] == 3
        snap = snapshot(api, group, ada)
        assert [e['amountMinor'] for e in snap['expenses']] == [12000]
        assert snap['deletedExpenses'] == []
        assert balances(snap) == {aid: 6000, bid: -6000}

    def test_replaying_a_create_does_not_resurrect_a_deleted_expense(self, database):
        api, ada, bob, group, record, url = setup(database)
        api.delete(url, headers=headers(ada))
        response = api.put(url, headers=headers(ada), json=record)  # the original create, re-sent late
        assert response.status_code == 409
        assert snapshot(api, group, ada)['expenses'] == []

    def test_a_lost_restore_response_can_be_retried(self, database):
        api, ada, bob, group, record, url = setup(database)
        api.delete(url, headers=headers(ada))
        restore = {**record, 'version': 2}
        first = api.put(url, headers=headers(ada), json=restore)
        retry = api.put(url, headers=headers(ada), json=restore)
        assert first.status_code == 200 and retry.status_code == 200
        assert retry.json() == first.json()

    def test_deleted_expenses_have_no_receipt_access(self, database):
        from io import BytesIO
        from PIL import Image
        api, ada, bob, group, record, url = setup(database)
        stream = BytesIO()
        Image.new('RGB', (2, 2), 'white').save(stream, format='JPEG')
        receipt = url + '/receipt'
        h = {**headers(ada), 'Content-Type': 'image/jpeg'}
        assert api.put(receipt, headers=h, content=stream.getvalue()).status_code == 200
        api.delete(url, headers=headers(ada))
        assert api.get(receipt, headers=headers(bob)).status_code == 404
        assert api.put(receipt, headers=h, content=stream.getvalue()).status_code == 404

    def test_expenses_and_tombstones_carry_updated_at(self, database):
        api, ada, bob, group, record, url = setup(database)
        [live] = snapshot(api, group, ada)['expenses']
        assert live['updatedAt'].endswith('Z')
        assert api.delete(url, headers=headers(ada)).status_code == 204
        [tombstone] = snapshot(api, group, ada)['deletedExpenses']
        assert tombstone['updatedAt'] >= live['updatedAt']
        assert tombstone['updatedAt'] == tombstone['deletedAt']
