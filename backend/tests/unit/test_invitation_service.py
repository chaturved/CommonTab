from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.core.security import hash_token
from app.repositories.groups import GroupRepository
from app.repositories.invitations import InvitationRepository
from app.repositories.members import MemberRepository
from app.repositories.users import UserRepository
from app.services.access import MembershipGuard
from app.services.invitations import InvitationService
from app.services.snapshots import SnapshotBuilder
from rows import invitation_row, member_row, user_row


class TestInvite:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.users = MagicMock(spec_set=UserRepository)
        self.invitations = MagicMock(spec_set=InvitationRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        me = member_row(name='Ada')
        self.group_id, self.user_id = me.group_id, me.user_id
        self.members.member_of.return_value = me
        self.cy = user_row(name='Cy', email='cy@example.com')
        self.users.user_by_id.return_value = self.cy
        self.members.is_member_email.return_value = False
        self.service = InvitationService(self.invitations, self.members, self.groups, self.users,
                                         MembershipGuard(self.members), self.snapshots)


    def invite(self, email='cy@example.com', member_id=None):
        return self.service.invite(str(self.group_id), str(self.user_id), email, member_id)

    def test_stores_only_the_hash_of_the_code(self):
        invitation = self.invite(' Cy@Example.com ')
        stored_hash, _group, email = self.invitations.insert_invitation.call_args.args[:3]
        assert invitation['email'] == email == 'cy@example.com'
        assert stored_hash == hash_token(invitation['inviteToken']) != invitation['inviteToken']

    def test_an_outsider_cannot_invite(self):
        self.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            self.invite()
        assert caught.value.status == 404
        self.invitations.insert_invitation.assert_not_called()

    def test_someone_who_is_already_a_member_is_a_conflict(self):
        self.members.is_member_email.return_value = True
        with pytest.raises(APIError) as caught:
            self.invite()
        assert caught.value.status == 409

    def test_inviting_a_person_who_already_has_an_account_is_rejected(self):
        person = member_row(group_id=self.group_id, user_id=uuid4())
        self.members.member.return_value = person
        with pytest.raises(APIError) as caught:
            self.invite(member_id=person.id)
        assert caught.value.status == 422

    def test_inviting_a_person_from_another_group_is_rejected(self):
        self.members.member.return_value = member_row(group_id=uuid4(), user_id=None)
        with pytest.raises(APIError) as caught:
            self.invite(member_id=uuid4())
        assert caught.value.status == 422


class TestAcceptInvite:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.members = MagicMock(spec_set=MemberRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.users = MagicMock(spec_set=UserRepository)
        self.invitations = MagicMock(spec_set=InvitationRepository)
        self.snapshots = MagicMock(spec_set=SnapshotBuilder)
        me = member_row(name='Ada')
        self.group_id, self.user_id = me.group_id, me.user_id
        self.members.member_of.return_value = me
        self.cy = user_row(name='Cy', email='cy@example.com')
        self.users.user_by_id.return_value = self.cy
        self.members.is_member_email.return_value = False
        self.service = InvitationService(self.invitations, self.members, self.groups, self.users,
                                         MembershipGuard(self.members), self.snapshots)
        self.invitation = invitation_row(group_id=self.group_id, token_hash=hash_token('code'))
        self.invitations.invitation.return_value = self.invitation
        self.members.member_of.return_value = None

    def accept(self, token='code'):
        return self.service.accept_invite(str(self.cy.id), token)

    def test_joins_the_group_marks_the_code_used_and_bumps_the_version(self):
        self.accept()
        self.members.insert_member.assert_called_once()
        assert self.members.insert_member.call_args.args[1:4] == (self.group_id, self.cy.id, 'Cy')
        assert self.invitations.accept_invitation.call_args.args[0] == hash_token('code')
        self.groups.bump_version.assert_called_once_with(self.group_id)
        self.snapshots.build.assert_called_once_with(self.group_id, self.cy.id)

    def test_looks_the_code_up_by_its_hash(self):
        self.accept()
        self.invitations.invitation.assert_called_once_with(hash_token('code'))

    def test_a_used_code_is_rejected(self):
        self.invitation.accepted_at = datetime.now(timezone.utc)
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404
        self.members.insert_member.assert_not_called()

    def test_an_unknown_code_is_rejected(self):
        self.invitations.invitation.return_value = None
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404

    def test_an_expired_code_is_rejected(self):
        self.invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404

    def test_the_code_belongs_to_one_email(self):
        self.cy.email = 'eve@example.com'
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 403
        self.members.insert_member.assert_not_called()

    def test_someone_already_in_the_group_is_a_conflict(self):
        self.members.member_of.return_value = member_row()
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 409

    def test_accepting_for_a_person_links_them_to_the_account_instead_of_adding_a_member(self):
        sam = member_row(group_id=self.group_id, user_id=None, name='Sam')
        self.invitation.member_id = sam.id
        self.members.member.return_value = sam
        self.accept()
        self.members.link_member.assert_called_once_with(sam.id, self.cy.id)
        self.members.insert_member.assert_not_called()

    def test_a_person_who_was_already_linked_is_a_conflict(self):
        self.invitation.member_id = uuid4()
        self.members.member.return_value = member_row(user_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.accept()
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')
