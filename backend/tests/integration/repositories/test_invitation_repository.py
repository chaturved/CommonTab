from datetime import timedelta
from uuid import uuid4

import pytest

from app.repositories.invitations import InvitationRepository
from seed import NOW, add_group, add_member, add_user


class TestInvitationRepository:
    @pytest.fixture(autouse=True)
    def setup(self, connection) -> None:
        self.connection = connection
        self.repo = InvitationRepository(connection)
        owner = add_user(connection)
        self.group = add_group(connection, owner)

    def test_an_invitation_is_found_by_its_hash_and_starts_unaccepted(self):
        self.repo.insert_invitation('hash-1', self.group, 'cy@example.com', NOW + timedelta(days=7))

        row = self.repo.invitation('hash-1')

        assert (row.group_id, row.email, row.accepted_at, row.member_id) == (self.group, 'cy@example.com', None, None)

    def test_an_invitation_can_point_at_a_person_without_an_account(self):
        sam = add_member(self.connection, self.group, None, 'Sam')
        self.repo.insert_invitation('hash-1', self.group, 'sam@example.com', NOW + timedelta(days=7), sam)

        assert self.repo.invitation('hash-1').member_id == sam

    def test_accepting_stamps_the_time(self):
        self.repo.insert_invitation('hash-1', self.group, 'cy@example.com', NOW + timedelta(days=7))

        self.repo.accept_invitation('hash-1', NOW)

        assert self.repo.invitation('hash-1').accepted_at == NOW

    def test_an_unknown_hash_is_none(self):
        assert self.repo.invitation(str(uuid4())) is None
