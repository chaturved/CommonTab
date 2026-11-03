from fastapi.testclient import TestClient

from app.main import create_app
from helpers import create_group, headers, join, m, register


def two_people(database):
    api = TestClient(create_app(database))
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    return api, ada, bob, group


def snapshot(api, group, user):
    return api.get(f"/v1/groups/{group['id']}", headers=headers(user)).json()


def test_members_are_people_in_the_group_not_account_ids(database):
    api, ada, bob, group = two_people(database)
    snap = snapshot(api, group, ada)
    by_name = {member['name']: member for member in snap['members']}
    assert set(by_name) == {'Ada', 'Bob'}
    ada_member = by_name['Ada']
    assert ada_member['userID'] == ada['user']['id']
    assert ada_member['email'] == 'ada@example.com'
    assert ada_member['id'] != ada['user']['id']  # a member id, not the account id
    assert snap['ownerID'] == ada_member['id']  # the owner is a member too


def test_me_member_id_is_the_viewers_own_member(database):
    api, ada, bob, group = two_people(database)
    assert snapshot(api, group, ada)['meMemberID'] == m(ada, group)
    assert snapshot(api, group, bob)['meMemberID'] == m(bob, group)
    assert m(ada, group) != m(bob, group)


def test_the_same_account_has_a_different_member_in_each_group(database):
    api, ada, bob, group = two_people(database)
    other = create_group(api, ada)
    assert other['meMemberID'] != m(ada, group)
    assert snapshot(api, other, ada)['meMemberID'] == other['meMemberID']


def test_groups_list_carries_me_member_id_for_each_group(database):
    api, ada, bob, group = two_people(database)
    other = create_group(api, ada)
    listed = {g['id']: g['meMemberID'] for g in api.get('/v1/groups', headers=headers(ada)).json()}
    assert listed == {group['id']: m(ada, group), other['id']: other['meMemberID']}
