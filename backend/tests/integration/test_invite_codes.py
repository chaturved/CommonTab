from helpers import client_for, create_group, expense, headers, m, register


class TestInviteCodes:
    def test_a_friend_joins_with_the_code_and_shares_the_groups_expenses(self, database):
        api = client_for(database)
        ada, bob = register(api, 'ada@example.com', 'Ada'), register(api, 'bob@example.com', 'Bob')
        group = create_group(api, ada)

        made = api.post(f"/v1/groups/{group['id']}/invite-code", headers=headers(ada), json={})
        assert made.status_code == 201
        joined = api.post('/v1/invitations/join', headers=headers(bob), json={'code': made.json()['code'].lower()})

        assert joined.status_code == 200
        assert {member['name'] for member in joined.json()['members']} == {'Ada', 'Bob'}
        record = expense(group, m(ada, group), [m(ada, group), joined.json()['meMemberID']], amount=1000)
        assert api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(bob), json=record).status_code == 200

    def test_one_group_code_serves_several_people_and_joining_twice_is_harmless(self, database):
        api = client_for(database)
        ada, bob, cy = (register(api, f'{n}@example.com', n.title()) for n in ('ada', 'bob', 'cy'))
        group = create_group(api, ada)
        code = api.post(f"/v1/groups/{group['id']}/invite-code", headers=headers(ada), json={}).json()['code']

        first = api.post('/v1/invitations/join', headers=headers(bob), json={'code': code})
        again = api.post('/v1/invitations/join', headers=headers(bob), json={'code': code})
        other = api.post('/v1/invitations/join', headers=headers(cy), json={'code': code})

        assert (first.status_code, again.status_code, other.status_code) == (200, 200, 200)
        assert len(other.json()['members']) == 3 and again.json()['version'] == first.json()['version']

    def test_a_code_for_a_person_links_their_past_expenses_to_the_account_once(self, database):
        api = client_for(database)
        ada, bob, cy = (register(api, f'{n}@example.com', n.title()) for n in ('ada', 'bob', 'cy'))
        group = create_group(api, ada)
        sam = api.put(f"/v1/groups/{group['id']}/members/{'6' * 8}-0000-4000-8000-000000000000", headers=headers(ada),
                      json={'name': 'Sam'}).json()['id']
        record = expense(group, sam, [m(ada, group), sam], amount=4000)
        api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)
        code = api.post(f"/v1/groups/{group['id']}/invite-code", headers=headers(ada), json={'memberID': sam}).json()['code']

        joined = api.post('/v1/invitations/join', headers=headers(bob), json={'code': code})
        second = api.post('/v1/invitations/join', headers=headers(cy), json={'code': code})

        assert joined.status_code == 200 and joined.json()['meMemberID'] == sam
        assert len(joined.json()['members']) == 2
        assert second.status_code == 404

    def test_a_wrong_or_garbled_code_is_404_and_outsiders_cannot_make_codes(self, database):
        api = client_for(database)
        ada, eve = register(api, 'ada@example.com', 'Ada'), register(api, 'eve@example.com', 'Eve')
        group = create_group(api, ada)

        assert api.post('/v1/invitations/join', headers=headers(eve), json={'code': 'ZZZZ-ZZZZ'}).status_code == 404
        assert api.post('/v1/invitations/join', headers=headers(eve), json={'code': 'nope'}).status_code == 404
        assert api.post(f"/v1/groups/{group['id']}/invite-code", headers=headers(eve), json={}).status_code == 404

    def test_a_code_does_not_work_as_an_email_invitation_and_vice_versa(self, database):
        api = client_for(database)
        ada, bob = register(api, 'ada@example.com', 'Ada'), register(api, 'bob@example.com', 'Bob')
        group = create_group(api, ada)
        code = api.post(f"/v1/groups/{group['id']}/invite-code", headers=headers(ada), json={}).json()['code']
        email_token = api.post(f"/v1/groups/{group['id']}/invitations", headers=headers(ada),
                               json={'email': 'bob@example.com'}).json()['inviteToken']

        assert api.post('/v1/invitations/accept', headers=headers(bob), json={'inviteToken': code}).status_code == 404
        assert api.post('/v1/invitations/join', headers=headers(bob), json={'code': email_token}).status_code == 422
