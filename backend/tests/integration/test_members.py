from uuid import uuid4

from helpers import client_for, create_group, expense, headers, join, m, register


def two_people(database):
    api = client_for(database)
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


# --- people without an account ---------------------------------------------------

def add_person(api, group, user, name='Sam', member_id=None):
    member_id = member_id or str(uuid4())
    response = api.put(f"/v1/groups/{group['id']}/members/{member_id}", headers=headers(user), json={'name': name})
    return member_id, response


def test_add_a_person_who_has_no_account(database):
    api, ada, bob, group = two_people(database)
    before = snapshot(api, group, ada)['version']
    sam, response = add_person(api, group, ada)
    assert response.status_code == 200, response.text
    assert response.json() == {'id': sam, 'name': 'Sam', 'userID': None, 'email': None}
    snap = snapshot(api, group, bob)  # visible to everyone in the group
    assert {'id': sam, 'name': 'Sam', 'userID': None, 'email': None} in snap['members']
    assert snap['version'] == before + 1


def test_repeating_the_same_request_changes_nothing(database):
    api, ada, bob, group = two_people(database)
    sam, _ = add_person(api, group, ada)
    version = snapshot(api, group, ada)['version']
    _, again = add_person(api, group, ada, 'Sam', sam)
    assert again.status_code == 200
    assert snapshot(api, group, ada)['version'] == version
    assert len([x for x in snapshot(api, group, ada)['members'] if x['name'] == 'Sam']) == 1


def test_rename_a_person_last_write_wins(database):
    api, ada, bob, group = two_people(database)
    sam, _ = add_person(api, group, ada)
    version = snapshot(api, group, ada)['version']
    add_person(api, group, bob, 'Samuel', sam)
    snap = snapshot(api, group, ada)
    assert [x['name'] for x in snap['members'] if x['id'] == sam] == ['Samuel']
    assert snap['version'] == version + 1


def test_two_people_may_share_a_name(database):
    api, ada, bob, group = two_people(database)
    add_person(api, group, ada, 'Sam')
    add_person(api, group, ada, 'Sam')
    assert len([x for x in snapshot(api, group, ada)['members'] if x['name'] == 'Sam']) == 2


def test_member_ids_cannot_cross_groups(database):
    api, ada, bob, group = two_people(database)
    other = create_group(api, ada)
    sam, _ = add_person(api, other, ada)
    _, response = add_person(api, group, ada, 'Sam', sam)
    assert response.status_code == 409 and response.json()['code'] == 'id_conflict'
    assert sam not in [x['id'] for x in snapshot(api, group, ada)['members']]


def test_only_group_members_can_add_people_and_names_are_validated(database):
    api, ada, bob, group = two_people(database)
    eve = register(api, 'eve@example.com', 'Eve')
    assert add_person(api, group, eve)[1].status_code == 404
    assert add_person(api, group, ada, '   ')[1].status_code == 422
    assert add_person(api, group, ada, 'x' * 81)[1].status_code == 422
    assert api.put(f"/v1/groups/{group['id']}/members/{uuid4()}", json={'name': 'Sam'}).status_code == 401


def test_an_unlinked_person_can_pay_and_share_expenses_and_be_paid_back(database):
    api, ada, bob, group = two_people(database)
    sam, _ = add_person(api, group, ada)
    aid, bid = m(ada, group), m(bob, group)
    record = expense(group, sam, [aid, bid, sam], amount=9000)  # Sam paid for everyone
    assert api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record).status_code == 200
    balances = {b['memberID']: b['minorUnits'] for b in snapshot(api, group, ada)['balances']}
    assert balances == {sam: 6000, aid: -3000, bid: -3000}
    pay = {'id': str(uuid4()), 'fromID': aid, 'toID': sam, 'amountMinor': 3000}
    assert api.post(f"/v1/groups/{group['id']}/settlements", headers=headers(ada), json=pay).status_code == 201
    # Bob is not a party to a payment between Ada and Sam.
    other = {'id': str(uuid4()), 'fromID': aid, 'toID': sam, 'amountMinor': 1}
    assert api.post(f"/v1/groups/{group['id']}/settlements", headers=headers(bob), json=other).status_code == 403


def test_expenses_cannot_use_a_person_from_another_group(database):
    api, ada, bob, group = two_people(database)
    other = create_group(api, ada)
    stranger, _ = add_person(api, other, ada)
    record = expense(group, m(ada, group), [m(ada, group), stranger])
    response = api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)
    assert response.status_code == 422


# --- linking a person to an account by invitation --------------------------------

def invite(api, group, inviter, email, member_id=None):
    body = {'email': email, **({'memberID': member_id} if member_id else {})}
    return api.post(f"/v1/groups/{group['id']}/invitations", headers=headers(inviter), json=body)


def accept(api, user, invitation):
    return api.post('/v1/invitations/accept', headers=headers(user), json={'inviteToken': invitation.json()['inviteToken']})


def test_accepting_an_invitation_for_a_person_links_them_to_the_account(database):
    api = client_for(database)
    ada = register(api, 'ada@example.com', 'Ada')
    group = create_group(api, ada)
    sam, _ = add_person(api, group, ada, 'Sam')
    record = expense(group, sam, [m(ada, group), sam], amount=4000)  # Sam paid before having an account
    api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)

    riya = register(api, 'riya@example.com', 'Riya')
    invitation = invite(api, group, ada, 'riya@example.com', sam)
    assert invitation.status_code == 201 and invitation.json()['memberID'] == sam
    accepted = accept(api, riya, invitation)
    assert accepted.status_code == 200, accepted.text

    snap = accepted.json()
    assert snap['meMemberID'] == sam  # Riya is Sam: no new member was created
    assert len(snap['members']) == 2
    person = [x for x in snap['members'] if x['id'] == sam][0]
    assert person['userID'] == riya['user']['id'] and person['email'] == 'riya@example.com'
    assert {b['memberID']: b['minorUnits'] for b in snap['balances']}[sam] == 2000  # her history came with her
    assert api.get('/v1/groups', headers=headers(riya)).json()[0]['id'] == group['id']


def test_an_invitation_without_a_person_still_adds_a_new_member(database):
    api, ada, bob, group = two_people(database)
    assert len(snapshot(api, group, ada)['members']) == 2
    assert len({x['id'] for x in snapshot(api, group, bob)['members']}) == 2


def test_cannot_invite_for_someone_who_already_has_an_account_or_another_groups_person(database):
    api, ada, bob, group = two_people(database)
    other = create_group(api, ada)
    stranger, _ = add_person(api, other, ada)
    assert invite(api, group, ada, 'new@example.com', m(bob, group)).status_code == 422
    assert invite(api, group, ada, 'new@example.com', stranger).status_code == 422
    assert invite(api, group, ada, 'new@example.com', str(uuid4())).status_code == 422


def test_a_person_can_only_be_linked_once(database):
    api = client_for(database)
    ada = register(api, 'ada@example.com', 'Ada')
    group = create_group(api, ada)
    sam, _ = add_person(api, group, ada, 'Sam')
    first = register(api, 'one@example.com', 'One')
    second = register(api, 'two@example.com', 'Two')
    to_first = invite(api, group, ada, 'one@example.com', sam)
    to_second = invite(api, group, ada, 'two@example.com', sam)
    assert accept(api, first, to_first).status_code == 200
    late = accept(api, second, to_second)
    assert late.status_code == 409 and late.json()['code'] == 'id_conflict'
    assert api.get('/v1/groups', headers=headers(second)).json() == []


def test_an_account_already_in_the_group_cannot_also_be_a_person_in_it(database):
    api = client_for(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    sam, _ = add_person(api, group, ada, 'Sam')
    for_sam = invite(api, group, ada, 'bob@example.com', sam)
    join(api, group, ada, bob)  # Bob joins through a different invitation first
    late = accept(api, bob, for_sam)
    assert late.status_code == 409
    snap = snapshot(api, group, ada)
    assert [x['userID'] for x in snap['members'] if x['id'] == sam] == [None]
