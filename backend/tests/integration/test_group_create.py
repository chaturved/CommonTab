from uuid import uuid4

from helpers import client_for, expense, headers, register


def setup(database):
    api = client_for(database)
    return api, register(api, 'ada@example.com', 'Ada')


def create(api, user, **body):
    return api.post('/v1/groups', headers=headers(user), json={'name': 'Trip', 'currencyCode': 'USD', **body})


def count(api, user):
    return len(api.get('/v1/groups', headers=headers(user)).json())


def test_a_client_chosen_id_is_used(database):
    api, ada = setup(database)
    gid = str(uuid4())
    response = create(api, ada, id=gid)
    assert response.status_code == 201 and response.json()['id'] == gid


def test_repeating_the_same_create_returns_the_group_without_making_another(database):
    api, ada = setup(database)
    gid = str(uuid4())
    first = create(api, ada, id=gid)
    again = create(api, ada, id=gid)
    assert again.status_code == 200
    assert again.json() == first.json()
    assert count(api, ada) == 1


def test_the_same_id_with_a_different_body_or_for_someone_elses_group_is_a_conflict(database):
    api, ada = setup(database)
    bob = register(api, 'bob@example.com', 'Bob')
    gid = str(uuid4())
    create(api, ada, id=gid)
    assert create(api, ada, id=gid, name='Other').status_code == 409
    assert create(api, ada, id=gid, currencyCode='EUR').status_code == 409
    theirs = create(api, bob, id=gid)  # Bob must not learn anything about Ada's group
    assert theirs.status_code == 409 and theirs.json()['code'] == 'id_conflict'
    assert count(api, bob) == 0


def test_without_members_the_creator_is_the_only_member(database):
    api, ada = setup(database)
    group = create(api, ada).json()
    assert [m['name'] for m in group['members']] == ['Ada']
    assert group['meMemberID'] == group['ownerID'] == group['members'][0]['id']


def test_creating_with_people_who_have_no_account(database):
    api, ada = setup(database)
    me, sam, riya = (str(uuid4()) for _ in range(3))
    response = create(api, ada, members=[{'id': me, 'name': 'Chaturved'}, {'id': sam, 'name': 'Sam'},
                                          {'id': riya, 'name': 'Riya'}], meMemberID=me)
    assert response.status_code == 201, response.text
    group = response.json()
    assert group['meMemberID'] == group['ownerID'] == me
    by_id = {m['id']: m for m in group['members']}
    assert set(by_id) == {me, sam, riya}
    assert by_id[me]['userID'] == ada['user']['id'] and by_id[me]['name'] == 'Chaturved'  # name as on the phone
    assert by_id[sam]['userID'] is None and by_id[riya]['email'] is None


def test_uploaded_people_can_be_used_in_expenses_straight_away(database):
    api, ada = setup(database)
    me, sam = str(uuid4()), str(uuid4())
    group = create(api, ada, members=[{'id': me, 'name': 'Me'}, {'id': sam, 'name': 'Sam'}], meMemberID=me).json()
    record = expense(group, sam, [me, sam], amount=5000)  # client-supplied expense uuid is kept
    saved = api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)
    assert saved.status_code == 200 and saved.json()['id'] == record['id']
    balances = {b['memberID']: b['minorUnits'] for b in api.get(f"/v1/groups/{group['id']}", headers=headers(ada)).json()['balances']}
    assert balances == {sam: 2500, me: -2500}


def test_repeating_an_upload_with_people_is_safe(database):
    api, ada = setup(database)
    gid, me, sam = str(uuid4()), str(uuid4()), str(uuid4())
    body = dict(id=gid, members=[{'id': me, 'name': 'Me'}, {'id': sam, 'name': 'Sam'}], meMemberID=me)
    assert create(api, ada, **body).status_code == 201
    assert create(api, ada, **body).status_code == 200
    changed = dict(body, members=[{'id': me, 'name': 'Me'}, {'id': sam, 'name': 'Samuel'}])
    assert create(api, ada, **changed).status_code == 409
    assert count(api, ada) == 1


def test_validation(database):
    api, ada = setup(database)
    me, sam = str(uuid4()), str(uuid4())
    people = [{'id': me, 'name': 'Me'}, {'id': sam, 'name': 'Sam'}]
    assert create(api, ada, members=people).status_code == 422  # which one am I?
    assert create(api, ada, members=people, meMemberID=str(uuid4())).status_code == 422  # not one of them
    assert create(api, ada, meMemberID=me).status_code == 422  # a me without people
    assert create(api, ada, members=[], meMemberID=me).status_code == 422
    assert create(api, ada, members=[people[0], people[0]], meMemberID=me).status_code == 422  # duplicate ids
    assert create(api, ada, members=[{'id': me, 'name': '  '}], meMemberID=me).status_code == 422
    many = [{'id': str(uuid4()), 'name': f'P{i}'} for i in range(51)]
    assert create(api, ada, members=many, meMemberID=many[0]['id']).status_code == 422
    assert count(api, ada) == 0


def test_a_member_id_already_used_elsewhere_rolls_the_whole_create_back(database):
    api, ada = setup(database)
    me, sam = str(uuid4()), str(uuid4())
    create(api, ada, members=[{'id': me, 'name': 'Me'}, {'id': sam, 'name': 'Sam'}], meMemberID=me)
    mine = str(uuid4())
    clash = create(api, ada, members=[{'id': mine, 'name': 'Me'}, {'id': sam, 'name': 'Sam'}], meMemberID=mine)
    assert clash.status_code == 409 and clash.json()['code'] == 'id_conflict'
    assert count(api, ada) == 1  # no half-made group
