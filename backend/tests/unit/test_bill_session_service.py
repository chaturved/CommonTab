from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.config import Settings
from app.core.errors import APIError
from app.repositories.bill_sessions import BillSessionRepository
from app.schemas.bill_sessions import Bill
from app.services.bill_sessions import BillSessionService


def a_bill() -> Bill:
    person = str(uuid4())
    return Bill.model_validate({
        'people': [{'id': person, 'name': 'Alex'}],
        'items': [{'id': str(uuid4()), 'name': 'Pasta', 'price': '19.99', 'assignedPersonIDs': [person]}],
        'tax': '1.60', 'tipPercentage': '18', 'receiptTotal': '21.59'})


class TestBillSessionService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.store = MagicMock(spec_set=BillSessionRepository)
        self.service = BillSessionService(self.store, Settings(database_url='', bill_session_lifetime_seconds=3600))

    def stored(self, token='secret', expires_in=3600, version=1) -> SimpleNamespace:
        from app.services.bill_sessions import BillSessionService as S
        return SimpleNamespace(id=uuid4(), token_hash=S._hash(token), version=version, bill={'items': []},
                               expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in))

    def test_creating_returns_the_secret_once_and_stores_only_its_hash(self):
        created = self.service.create(a_bill())

        stored_hash = self.store.insert.call_args.args[1]
        assert created['version'] == 1
        assert stored_hash != created['accessToken'] and len(stored_hash) == 64

    def test_creating_clears_out_expired_sessions_first(self):
        self.service.create(a_bill())

        self.store.delete_expired.assert_called_once()

    def test_the_session_lives_as_long_as_the_setting_says(self):
        created = self.service.create(a_bill())

        remaining = datetime.fromisoformat(created['expiresAt']) - datetime.now(timezone.utc)
        assert timedelta(minutes=59) < remaining <= timedelta(hours=1)

    def test_reading_with_the_right_secret_returns_the_bill(self):
        row = self.stored()
        self.store.get.return_value = row

        assert self.service.get(row.id, 'secret')['version'] == 1

    def test_a_wrong_secret_looks_like_a_missing_session(self):
        self.store.get.return_value = self.stored()

        with pytest.raises(APIError) as caught:
            self.service.get(uuid4(), 'incorrect')

        assert caught.value.status == 404

    def test_an_unknown_session_is_404(self):
        self.store.get.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.get(uuid4(), 'secret')

        assert caught.value.status == 404

    def test_an_expired_session_is_gone(self):
        self.store.get.return_value = self.stored(expires_in=-1)

        with pytest.raises(APIError) as caught:
            self.service.get(uuid4(), 'secret')

        assert caught.value.status == 410

    def test_updating_with_a_stale_version_is_a_conflict(self):
        self.store.get.return_value = self.stored()
        self.store.update.return_value = False

        with pytest.raises(APIError) as caught:
            self.service.update(uuid4(), 'secret', 1, a_bill())

        assert caught.value.status == 409

    def test_updating_with_the_current_version_returns_the_new_state(self):
        row = self.stored()
        self.store.get.side_effect = [row, SimpleNamespace(**{**row.__dict__, 'version': 2})]
        self.store.update.return_value = True

        assert self.service.update(row.id, 'secret', 1, a_bill())['version'] == 2
