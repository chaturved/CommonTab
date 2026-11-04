import pytest

from helpers import client_for, create_group, expense, headers, join, m, register

PASSWORD = 'correct horse battery staple'


class TestActivityFeed:
    @pytest.fixture(autouse=True)
    def setup(self, database) -> None:
        self.api = client_for(database)
        self.ada = register(self.api, 'ada@example.com', 'Ada')
        self.sam = register(self.api, 'sam@example.com', 'Sam')
        self.group = create_group(self.api, self.ada)
        join(self.api, self.group, self.ada, self.sam)
        self.gid = self.group['id']
        self.dinner = expense(self.group, m(self.ada, self.group), [m(self.ada, self.group), m(self.sam, self.group)], amount=16000)

    def feed(self, who, **params):
        response = self.api.get('/v1/activity', headers=headers(who), params=params)
        assert response.status_code == 200, response.text
        return response.json()

    def put(self, who, body):
        response = self.api.put(f"/v1/groups/{self.gid}/expenses/{body['id']}", headers=headers(who), json=body)
        assert response.status_code == 200, response.text
        return response.json()

    def test_a_group_starts_with_its_creation_and_the_person_who_joined(self):
        kinds = [(e['kind'], e['actorID']) for e in self.feed(self.ada)['events']]

        assert kinds == [('group.created', m(self.ada, self.group)), ('member.joined', m(self.sam, self.group))]

    def test_adding_editing_and_deleting_an_expense_and_paying_are_all_recorded_in_order(self):
        saved = self.put(self.ada, self.dinner)
        self.put(self.ada, {**self.dinner, 'amountMinor': 16350, 'version': saved['version']})
        payment = {'id': '00000000-0000-4000-8000-0000000000aa', 'fromID': m(self.sam, self.group), 'toID': m(self.ada, self.group), 'amountMinor': 1000}
        assert self.api.post(f'/v1/groups/{self.gid}/settlements', headers=headers(self.sam), json=payment).status_code == 201
        assert self.api.delete(f"/v1/groups/{self.gid}/expenses/{self.dinner['id']}", headers=headers(self.ada)).status_code == 204

        events = self.feed(self.sam)['events'][2:]

        assert [e['kind'] for e in events] == ['expense.added', 'expense.edited', 'payment.recorded', 'expense.deleted']
        assert [e['seq'] for e in events] == sorted(e['seq'] for e in events)
        assert events[1]['data'] == {'merchant': 'Groceries', 'amountMinor': 16350, 'previousMerchant': 'Groceries', 'previousAmountMinor': 16000}
        assert events[2]['actorID'] == m(self.sam, self.group) and events[2]['data']['amountMinor'] == 1000
        assert events[0]['subjectID'] == self.dinner['id'] and events[0]['at'].endswith('Z')

    def test_saving_the_same_expense_again_does_not_add_to_the_feed(self):
        self.put(self.ada, self.dinner)
        count = len(self.feed(self.ada)['events'])

        self.put(self.ada, self.dinner)

        assert len(self.feed(self.ada)['events']) == count

    def test_the_cursor_returns_only_what_is_new_and_a_small_page_can_be_followed(self):
        self.put(self.ada, self.dinner)
        everything = self.feed(self.ada)
        page = self.feed(self.ada, limit=1)

        assert len(page['events']) == 1 and page['next'] == everything['events'][0]['seq']
        rest = self.feed(self.ada, since=page['next'])
        assert [e['seq'] for e in rest['events']] == [e['seq'] for e in everything['events'][1:]]
        assert self.feed(self.ada, since=everything['next']) == {'events': [], 'next': everything['next']}

    def test_you_only_see_groups_you_belong_to(self):
        cy = register(self.api, 'cy@example.com', 'Cy')
        assert self.feed(cy) == {'events': [], 'next': 0}

    def test_leaving_archiving_and_removing_are_recorded_and_a_leaver_stops_getting_the_group(self):
        assert self.api.post(f'/v1/groups/{self.gid}/archive', headers=headers(self.ada)).status_code == 204
        assert self.api.post(f'/v1/groups/{self.gid}/unarchive', headers=headers(self.ada)).status_code == 204
        assert self.api.post(f'/v1/groups/{self.gid}/leave', headers=headers(self.sam)).status_code == 204

        kinds = [e['kind'] for e in self.feed(self.ada)['events']]

        assert kinds[2:] == ['group.archived', 'group.unarchived', 'member.left']
        assert self.feed(self.sam) == {'events': [], 'next': 0}

    def test_deleting_an_account_that_owned_the_only_group_works_with_its_activity(self):
        solo = register(self.api, 'solo@example.com', 'Solo')
        create_group(self.api, solo)

        assert self.api.post('/v1/me/delete', headers=headers(solo), json={'password': PASSWORD}).status_code == 204
