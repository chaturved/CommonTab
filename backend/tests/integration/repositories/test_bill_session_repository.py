from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.bill_sessions import BillSessionRepository
from seed import NOW


class TestBillSessionRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = BillSessionRepository(connection)
        self.id = uuid4()
        self.bill = {'items': [{'name': 'Pasta', 'price': '19.99'}], 'tax': '1.60'}
        self.repo.insert(self.id, 'token-hash', self.bill, NOW + timedelta(days=7))

    def test_the_bill_comes_back_exactly_as_stored_including_decimal_strings(self):
        row = self.repo.get(self.id)

        assert (row.bill, row.version, row.token_hash) == (self.bill, 1, 'token-hash')

    def test_an_unknown_session_is_none(self):
        assert self.repo.get(uuid4()) is None

    def test_updating_with_the_current_version_replaces_the_bill_and_bumps_the_version(self):
        assert self.repo.update(self.id, 1, {'items': []}, NOW)

        row = self.repo.get(self.id)
        assert (row.bill, row.version) == ({'items': []}, 2)

    def test_updating_with_a_stale_version_changes_nothing(self):
        self.repo.update(self.id, 1, {'items': []}, NOW)

        assert not self.repo.update(self.id, 1, {'items': ['late']}, NOW)
        assert self.repo.get(self.id).bill == {'items': []}

    def test_an_expired_session_cannot_be_updated(self):
        assert not self.repo.update(self.id, 1, {'items': []}, NOW + timedelta(days=8))

    def test_expired_sessions_are_deleted_and_live_ones_kept(self):
        expired = uuid4()
        self.repo.insert(expired, 'old', self.bill, NOW - timedelta(seconds=1))

        self.repo.delete_expired(NOW)

        assert self.repo.get(expired) is None and self.repo.get(self.id) is not None
