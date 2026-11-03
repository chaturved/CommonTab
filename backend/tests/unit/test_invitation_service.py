from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.core.security import hash_token
from app.services.invitations import InvitationService
from mocks import make_repos
from rows import invitation_row, member_row, user_row


class TestInvite:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.repos = make_repos()
        self.repos.cy = user_row(name='Cy', email='cy@example.com')
        self.repos.users.user_by_id.return_value = self.repos.cy
        self.repos.members.is_member_email.return_value = False
        self.service = InvitationService(self.repos.invitations, self.repos.members, self.repos.groups,
                                         self.repos.users, self.repos.guard, self.repos.snapshots)

    def invite(self, email='cy@example.com', member_id=None):
        return self.service.invite(str(self.repos.group_id), str(self.repos.user_id), email, member_id)

    def test_stores_only_the_hash_of_the_code(self):
        invitation = self.invite(' Cy@Example.com ')
        stored_hash, _group, email = self.repos.invitations.insert_invitation.call_args.args[:3]
        assert invitation['email'] == email == 'cy@example.com'
        assert stored_hash == hash_token(invitation['inviteToken']) != invitation['inviteToken']

    def test_an_outsider_cannot_invite(self):
        self.repos.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            self.invite()
        assert caught.value.status == 404
        self.repos.invitations.insert_invitation.assert_not_called()

    def test_someone_who_is_already_a_member_is_a_conflict(self):
        self.repos.members.is_member_email.return_value = True
        with pytest.raises(APIError) as caught:
            self.invite()
        assert caught.value.status == 409

    def test_inviting_a_person_who_already_has_an_account_is_rejected(self):
        person = member_row(group_id=self.repos.group_id, user_id=uuid4())
        self.repos.members.member.return_value = person
        with pytest.raises(APIError) as caught:
            self.invite(member_id=person.id)
        assert caught.value.status == 422

    def test_inviting_a_person_from_another_group_is_rejected(self):
        self.repos.members.member.return_value = member_row(group_id=uuid4(), user_id=None)
        with pytest.raises(APIError) as caught:
            self.invite(member_id=uuid4())
        assert caught.value.status == 422


class TestAcceptInvite:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.repos = make_repos()
        self.repos.cy = user_row(name='Cy', email='cy@example.com')
        self.repos.users.user_by_id.return_value = self.repos.cy
        self.repos.members.is_member_email.return_value = False
        self.service = InvitationService(self.repos.invitations, self.repos.members, self.repos.groups,
                                         self.repos.users, self.repos.guard, self.repos.snapshots)
        self.repos.invitation = invitation_row(group_id=self.repos.group_id, token_hash=hash_token('code'))
        self.repos.invitations.invitation.return_value = self.repos.invitation
        self.repos.members.member_of.return_value = None  # Cy is not in the group yet

    def accept(self, token='code'):
        return self.service.accept_invite(str(self.repos.cy.id), token)

    def test_joins_the_group_marks_the_code_used_and_bumps_the_version(self):
        self.accept()
        self.repos.members.insert_member.assert_called_once()
        assert self.repos.members.insert_member.call_args.args[1:4] == (self.repos.group_id, self.repos.cy.id, 'Cy')
        assert self.repos.invitations.accept_invitation.call_args.args[0] == hash_token('code')
        self.repos.groups.bump_version.assert_called_once_with(self.repos.group_id)
        self.repos.snapshots.build.assert_called_once_with(self.repos.group_id, self.repos.cy.id)

    def test_looks_the_code_up_by_its_hash(self):
        self.accept()
        self.repos.invitations.invitation.assert_called_once_with(hash_token('code'))

    def test_a_used_code_is_rejected(self):
        self.repos.invitation.accepted_at = datetime.now(timezone.utc)
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404
        self.repos.members.insert_member.assert_not_called()

    def test_an_unknown_code_is_rejected(self):
        self.repos.invitations.invitation.return_value = None
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404

    def test_an_expired_code_is_rejected(self):
        self.repos.invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 404

    def test_the_code_belongs_to_one_email(self):
        self.repos.cy.email = 'eve@example.com'
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 403
        self.repos.members.insert_member.assert_not_called()

    def test_someone_already_in_the_group_is_a_conflict(self):
        self.repos.members.member_of.return_value = member_row()
        with pytest.raises(APIError) as caught:
            self.accept()
        assert caught.value.status == 409

    def test_accepting_for_a_person_links_them_to_the_account_instead_of_adding_a_member(self):
        sam = member_row(group_id=self.repos.group_id, user_id=None, name='Sam')
        self.repos.invitation.member_id = sam.id
        self.repos.members.member.return_value = sam
        self.accept()
        self.repos.members.link_member.assert_called_once_with(sam.id, self.repos.cy.id)
        self.repos.members.insert_member.assert_not_called()

    def test_a_person_who_was_already_linked_is_a_conflict(self):
        self.repos.invitation.member_id = uuid4()
        self.repos.members.member.return_value = member_row(user_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.accept()
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')
