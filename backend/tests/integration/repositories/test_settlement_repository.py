from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.settlements import SettlementRepository
from seed import NOW, add_group, add_member, add_user


class TestSettlementRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.repo = SettlementRepository(connection)
        owner = add_user(connection)
        self.group = add_group(connection, owner)
        self.ada = add_member(connection, self.group, owner, 'Ada')
        self.sam = add_member(connection, self.group, None, 'Sam')

    def test_a_payment_is_stored_once_per_id(self):
        payment_id = uuid4()

        assert self.repo.insert_settlement(payment_id, self.group, self.sam, self.ada, 500, NOW)
        assert not self.repo.insert_settlement(payment_id, self.group, self.sam, self.ada, 999, NOW)

        stored = self.repo.settlement(payment_id)
        assert (stored.from_id, stored.to_id, stored.amount_minor) == (self.sam, self.ada, 500)

    def test_the_group_lists_payments_newest_first(self):
        first, second = uuid4(), uuid4()
        self.repo.insert_settlement(first, self.group, self.sam, self.ada, 100, NOW)
        self.repo.insert_settlement(second, self.group, self.sam, self.ada, 200, NOW + timedelta(minutes=1))

        assert [s.id for s in self.repo.settlements(self.group)] == [second, first]

    def test_an_unknown_payment_is_none(self):
        assert self.repo.settlement(uuid4()) is None
