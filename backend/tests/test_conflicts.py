from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app

from helpers import create_group, expense, headers, join, register


def setup(database):
    api = TestClient(create_app(database))
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    aid, bid = ada['user']['id'], bob['user']['id']
    record = expense(group, aid, [aid, bid], amount=10001)
    url = f"/v1/groups/{group['id']}/expenses/{record['id']}"
    assert api.put(url, headers=headers(ada), json=record).status_code == 200
    return api, ada, bob, group, record, url


def test_stale_edit_returns_409_with_the_current_record(database):
    api, ada, bob, group, record, url = setup(database)
    # Bob edits on top of version 1 first.
    bobs = {**record, 'version': 1, 'amountMinor': 20000, 'notes': "Bob's edit"}
    assert api.put(url, headers=headers(bob), json=bobs).status_code == 200
    # Ada's edit, also based on version 1, is now stale.
    adas = {**record, 'version': 1, 'amountMinor': 30000}
    response = api.put(url, headers=headers(ada), json=adas)
    assert response.status_code == 409
    body = response.json()
    assert body['code'] == 'version_conflict'
    assert body['detail']
    assert body['current']['version'] == 2
    assert body['current']['amountMinor'] == 20000
    assert body['current']['notes'] == "Bob's edit"
    assert [a['minorUnits'] for a in body['current']['allocations']] == [10000, 10000]


def test_create_over_existing_with_different_content_is_a_conflict_with_current(database):
    api, ada, bob, group, record, url = setup(database)
    again = {**record, 'amountMinor': 999}  # version null: claims to be a new expense
    response = api.put(url, headers=headers(ada), json=again)
    assert response.status_code == 409
    assert response.json()['current']['amountMinor'] == 10001


def test_other_conflicts_have_a_code_but_no_current_record(database):
    api, ada, bob, group, record, url = setup(database)
    missing = expense(group, ada['user']['id'], [ada['user']['id']])
    missing['version'] = 3
    response = api.put(f"/v1/groups/{group['id']}/expenses/{missing['id']}", headers=headers(ada), json=missing)
    assert response.status_code == 409
    assert response.json()['code'] == 'not_found'
    assert 'current' not in response.json()


def test_errors_without_a_code_keep_the_plain_detail_shape(database):
    api, ada, *_ = setup(database)
    response = api.get(f'/v1/groups/{uuid4()}', headers=headers(ada))
    assert response.status_code == 404
    assert response.json() == {'detail': 'Group not found'}
