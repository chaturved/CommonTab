from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.core.security import hash_token
from app.domain.short_codes import normalize_code
from app.repositories.groups import GroupRepository
from app.repositories.invitations import InvitationRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.invitations import InvitationService
from app.services.snapshots import SnapshotBuilder
from rows import invitation_row, member_row, user_row

CODE = 'ABCD-2345'


class TestInviteCodeService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.users = MagicMock(spec_set=UserRepository)
        self.invitations = MagicMock(spec_set=InvitationRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        self.me = member_row(name='Ada')
        self.group_id, self.user_id = self.me.group_id, self.me.user_id
        self.members.member_of.return_value = self.me
        self.cy = user_row(name='Cy', email='cy@example.com')
        self.users.user_by_id.return_value = self.cy
        self.snapshots.build.return_value = {'id': 'snapshot'}
        self.service = InvitationService(self.invitations, self.members, self.groups, self.users,
                                         MembershipGuard(self.members), self.snapshots)


    def test_a_code_is_stored_hashed_with_no_email_and_shown_in_two_groups(self):
        made = self.service.create_code(str(self.group_id), str(self.user_id))

        stored_hash, group_id, email, expires, member_id = self.invitations.insert_invitation.call_args.args
        assert len(made['code']) == 9 and made['code'][4] == '-'
        assert stored_hash == hash_token(normalize_code(made['code']))
        assert (group_id, email, member_id) == (self.group_id, None, None)
        assert timedelta(days=6) < expires - datetime.now(timezone.utc) <= timedelta(days=7)

    def test_a_code_for_a_person_remembers_who(self):
        sam = member_row(group_id=self.group_id, user_id=None, name='Sam')
        self.members.member.return_value = sam

        made = self.service.create_code(str(self.group_id), str(self.user_id), sam.id)

        assert self.invitations.insert_invitation.call_args.args[4] == sam.id
        assert made['memberID'] == str(sam.id)

    def test_a_code_for_a_person_who_has_an_account_is_rejected(self):
        self.members.member.return_value = member_row(group_id=self.group_id, user_id=uuid4())

        with pytest.raises(APIError) as caught:
            self.service.create_code(str(self.group_id), str(self.user_id), uuid4())

        assert caught.value.status == 422
        self.invitations.insert_invitation.assert_not_called()

    def test_an_outsider_cannot_make_a_code(self):
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.create_code(str(self.group_id), str(uuid4()))

        assert caught.value.status == 404


    def a_code_for_the_group(self, **changes):
        row = invitation_row(**{'group_id': self.group_id, 'email': None, 'token_hash': hash_token('ABCD2345'), **changes})
        self.invitations.invitation.return_value = row
        return row

    def test_joining_adds_the_account_as_a_new_member_and_bumps_the_group(self):
        self.a_code_for_the_group()
        self.members.member_of.return_value = None

        group = self.service.join_with_code(str(self.cy.id), CODE)

        assert group == {'id': 'snapshot'}
        assert self.members.insert_member.call_args.args[1:4] == (self.group_id, self.cy.id, 'Cy')
        self.groups.bump_version.assert_called_once_with(self.group_id)
        self.invitations.accept_invitation.assert_not_called()

    def test_the_code_is_looked_up_by_the_hash_of_its_normalized_form(self):
        self.a_code_for_the_group()
        self.members.member_of.return_value = None

        self.service.join_with_code(str(self.cy.id), ' abcd 2345 ')

        self.invitations.invitation.assert_called_once_with(hash_token('ABCD2345'))

    def test_joining_a_group_you_are_already_in_just_returns_it(self):
        self.a_code_for_the_group()

        group = self.service.join_with_code(str(self.cy.id), CODE)

        assert group == {'id': 'snapshot'}
        self.members.insert_member.assert_not_called()
        self.groups.bump_version.assert_not_called()

    def test_a_code_for_a_person_links_them_and_is_then_used_up(self):
        sam = member_row(group_id=self.group_id, user_id=None, name='Sam')
        self.a_code_for_the_group(member_id=sam.id)
        self.members.member_of.return_value = None
        self.members.member.return_value = sam

        self.service.join_with_code(str(self.cy.id), CODE)

        self.members.link_member.assert_called_once_with(sam.id, self.cy.id)
        self.members.insert_member.assert_not_called()
        self.invitations.accept_invitation.assert_called_once()

    def test_a_person_who_was_linked_in_the_meantime_is_a_conflict(self):
        self.a_code_for_the_group(member_id=uuid4())
        self.members.member_of.return_value = None
        self.members.member.return_value = member_row(user_id=uuid4())

        with pytest.raises(APIError) as caught:
            self.service.join_with_code(str(self.cy.id), CODE)

        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')

    @pytest.mark.parametrize('changes', [
        {'expires_at': datetime(2000, 1, 1, tzinfo=timezone.utc)},
        {'accepted_at': datetime(2026, 1, 1, tzinfo=timezone.utc)},
        {'email': 'cy@example.com'},
    ])
    def test_an_expired_used_or_email_bound_invitation_cannot_be_joined_with(self, changes):
        self.a_code_for_the_group(**changes)
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.join_with_code(str(self.cy.id), CODE)

        assert caught.value.status == 404
        self.members.insert_member.assert_not_called()

    def test_an_unknown_code_is_404(self):
        self.invitations.invitation.return_value = None

        with pytest.raises(APIError) as caught:
            self.service.join_with_code(str(self.cy.id), CODE)

        assert caught.value.status == 404

    def test_a_code_cannot_be_used_on_the_email_accept_route(self):
        self.a_code_for_the_group()

        with pytest.raises(APIError) as caught:
            self.service.accept_invite(str(self.cy.id), 'ABCD2345')

        assert caught.value.status == 404
