from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.core.security import hash_token
from app.services.invitations import InvitationService
from rows import invitation_row, member_row, user_row


@pytest.fixture
def service(repos) -> InvitationService:
    repos.cy = user_row(name='Cy', email='cy@example.com')
    repos.users.user_by_id.return_value = repos.cy
    repos.members.is_member_email.return_value = False
    return InvitationService(repos.invitations, repos.members, repos.groups, repos.users, repos.guard, repos.snapshots)


class TestInvite:
    def invite(self, service, repos, email='cy@example.com', member_id=None):
        return service.invite(str(repos.group_id), str(repos.user_id), email, member_id)

    def test_stores_only_the_hash_of_the_code(self, service, repos):
        invitation = self.invite(service, repos, ' Cy@Example.com ')
        stored_hash, _group, email = repos.invitations.insert_invitation.call_args.args[:3]
        assert invitation['email'] == email == 'cy@example.com'
        assert stored_hash == hash_token(invitation['inviteToken']) != invitation['inviteToken']

    def test_an_outsider_cannot_invite(self, service, repos):
        repos.members.member_of.return_value = None
        with pytest.raises(APIError) as caught:
            self.invite(service, repos)
        assert caught.value.status == 404
        repos.invitations.insert_invitation.assert_not_called()

    def test_someone_who_is_already_a_member_is_a_conflict(self, service, repos):
        repos.members.is_member_email.return_value = True
        with pytest.raises(APIError) as caught:
            self.invite(service, repos)
        assert caught.value.status == 409

    def test_inviting_a_person_who_already_has_an_account_is_rejected(self, service, repos):
        person = member_row(group_id=repos.group_id, user_id=uuid4())
        repos.members.member.return_value = person
        with pytest.raises(APIError) as caught:
            self.invite(service, repos, member_id=person.id)
        assert caught.value.status == 422

    def test_inviting_a_person_from_another_group_is_rejected(self, service, repos):
        repos.members.member.return_value = member_row(group_id=uuid4(), user_id=None)
        with pytest.raises(APIError) as caught:
            self.invite(service, repos, member_id=uuid4())
        assert caught.value.status == 422


class TestAcceptInvite:
    def accept(self, service, repos, token='code'):
        return service.accept_invite(str(repos.cy.id), token)

    @pytest.fixture(autouse=True)
    def pending(self, service, repos):
        repos.invitation = invitation_row(group_id=repos.group_id, token_hash=hash_token('code'))
        repos.invitations.invitation.return_value = repos.invitation
        repos.members.member_of.return_value = None  # Cy is not in the group yet

    def test_joins_the_group_marks_the_code_used_and_bumps_the_version(self, service, repos):
        self.accept(service, repos)
        repos.members.insert_member.assert_called_once()
        assert repos.members.insert_member.call_args.args[1:4] == (repos.group_id, repos.cy.id, 'Cy')
        assert repos.invitations.accept_invitation.call_args.args[0] == hash_token('code')
        repos.groups.bump_version.assert_called_once_with(repos.group_id)
        repos.snapshots.build.assert_called_once_with(repos.group_id, repos.cy.id)

    def test_looks_the_code_up_by_its_hash(self, service, repos):
        self.accept(service, repos)
        repos.invitations.invitation.assert_called_once_with(hash_token('code'))

    def test_a_used_code_is_rejected(self, service, repos):
        repos.invitation.accepted_at = datetime.now(timezone.utc)
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert caught.value.status == 404
        repos.members.insert_member.assert_not_called()

    def test_an_unknown_code_is_rejected(self, service, repos):
        repos.invitations.invitation.return_value = None
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert caught.value.status == 404

    def test_an_expired_code_is_rejected(self, service, repos):
        repos.invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert caught.value.status == 404

    def test_the_code_belongs_to_one_email(self, service, repos):
        repos.cy.email = 'eve@example.com'
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert caught.value.status == 403
        repos.members.insert_member.assert_not_called()

    def test_someone_already_in_the_group_is_a_conflict(self, service, repos):
        repos.members.member_of.return_value = member_row()
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert caught.value.status == 409

    def test_accepting_for_a_person_links_them_to_the_account_instead_of_adding_a_member(self, service, repos):
        sam = member_row(group_id=repos.group_id, user_id=None, name='Sam')
        repos.invitation.member_id = sam.id
        repos.members.member.return_value = sam
        self.accept(service, repos)
        repos.members.link_member.assert_called_once_with(sam.id, repos.cy.id)
        repos.members.insert_member.assert_not_called()

    def test_a_person_who_was_already_linked_is_a_conflict(self, service, repos):
        repos.invitation.member_id = uuid4()
        repos.members.member.return_value = member_row(user_id=uuid4())
        with pytest.raises(APIError) as caught:
            self.accept(service, repos)
        assert (caught.value.status, caught.value.code) == (409, 'id_conflict')
