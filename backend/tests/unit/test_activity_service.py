from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.repositories.activity import ActivityRepository
from app.repositories.groups import GroupRepository
from app.services.activity import MAX_PAGE, ActivityService
from rows import NOW


def event(seq, **changes):
    return SimpleNamespace(**{'seq': seq, 'group_id': uuid4(), 'actor_id': uuid4(), 'kind': 'expense.added',
                              'subject_id': uuid4(), 'data': {'merchant': 'Dinner'}, 'created_at': NOW, **changes})


class TestActivityService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.activity = MagicMock(spec_set=ActivityRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.user_id = uuid4()
        self.mine = [uuid4(), uuid4()]
        self.groups.group_ids_for_user.return_value = self.mine
        self.service = ActivityService(self.activity, self.groups)

    def test_asks_only_for_groups_you_can_use_after_the_cursor(self):
        self.activity.since.return_value = []

        feed = self.service.feed(str(self.user_id), 7, 50)

        self.activity.since.assert_called_once_with(self.mine, 7, 50)
        assert feed == {'events': [], 'next': 7}

    def test_each_event_carries_its_sequence_actor_subject_and_time_and_the_cursor_moves_on(self):
        row = event(12)
        self.activity.since.return_value = [event(11), row]

        feed = self.service.feed(str(self.user_id), 0, 200)

        assert feed['next'] == 12
        assert feed['events'][1] == {'seq': 12, 'groupID': str(row.group_id), 'actorID': str(row.actor_id), 'kind': 'expense.added',
                                     'subjectID': str(row.subject_id), 'data': {'merchant': 'Dinner'}, 'at': '2026-09-30T12:00:00Z'}

    def test_an_event_with_no_actor_or_subject_says_so(self):
        self.activity.since.return_value = [event(1, actor_id=None, subject_id=None)]

        item = self.service.feed(str(self.user_id), 0, 10)['events'][0]

        assert (item['actorID'], item['subjectID']) == (None, None)

    def test_a_page_is_never_bigger_than_the_maximum(self):
        self.activity.since.return_value = []

        self.service.feed(str(self.user_id), 0, 10_000)

        assert self.activity.since.call_args.args[2] == MAX_PAGE
