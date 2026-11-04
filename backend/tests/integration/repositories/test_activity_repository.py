from uuid import uuid4

import pytest

from app.repositories.activity import ActivityRepository
from seed import NOW, add_group, add_member, add_user


class TestActivityRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = ActivityRepository(connection)
        owner = add_user(connection)
        self.group = add_group(connection, owner)
        self.other = add_group(connection, owner)
        self.ada = add_member(connection, self.group, owner, 'Ada')

    def test_events_come_back_in_the_order_they_were_recorded_with_their_data(self):
        subject = uuid4()
        self.repo.record(self.group, self.ada, 'expense.added', subject, {'merchant': 'Dinner', 'amountMinor': 100}, NOW)
        self.repo.record(self.group, None, 'group.archived', None, {}, NOW)

        rows = self.repo.since([self.group], 0, 10)

        assert [r.kind for r in rows] == ['expense.added', 'group.archived']
        assert (rows[0].actor_id, rows[0].subject_id, rows[0].data) == (self.ada, subject, {'merchant': 'Dinner', 'amountMinor': 100})
        assert rows[0].seq < rows[1].seq and rows[1].actor_id is None

    def test_only_the_asked_groups_after_the_cursor_up_to_the_limit(self):
        for kind in ('a', 'b', 'c'):
            self.repo.record(self.group, self.ada, kind, None, {}, NOW)
        self.repo.record(self.other, None, 'elsewhere', None, {}, NOW)
        first = self.repo.since([self.group], 0, 10)

        assert [r.kind for r in self.repo.since([self.group], first[0].seq, 10)] == ['b', 'c']
        assert [r.kind for r in self.repo.since([self.group], 0, 2)] == ['a', 'b']
        assert [r.kind for r in self.repo.since([self.other], 0, 10)] == ['elsewhere']

    def test_no_groups_means_no_events(self):
        assert self.repo.since([], 0, 10) == []
