from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.repositories.members import MemberRepository
from app.services.access import MembershipGuard
from rows import member_row


class TestMembershipGuard:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.guard = MembershipGuard(self.members)

    def test_a_member_gets_their_member_record(self):
        me = member_row()
        self.members.member_of.return_value = me

        assert self.guard.require(me.group_id, me.user_id) is me

    def test_someone_outside_the_group_gets_404_so_the_group_stays_hidden(self):
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.guard.require(uuid4(), uuid4())

        assert (caught.value.status, caught.value.message) == (404, 'Group not found')
