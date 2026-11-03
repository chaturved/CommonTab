from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.services.invitations import InvitationService


@pytest.fixture
def service(world) -> InvitationService:
    return InvitationService(world.invitations, world.members, world.groups, world.users, world.guard, world.snapshots)


class TestInvite:
    def test_stores_only_the_hash_of_the_code(self, service, world):
        invitation = service.invite(str(world.group_id), str(world.ada.id), ' Cy@Example.com ')
        assert invitation['email'] == 'cy@example.com'
        assert invitation['inviteToken'] not in world.invitations.rows

    def test_an_outsider_cannot_invite(self, service, world):
        outsider = world.users.add('Eve', 'eve@example.com')
        with pytest.raises(APIError) as caught:
            service.invite(str(world.group_id), str(outsider.id), 'cy@example.com')
        assert caught.value.status == 404

    def test_inviting_a_person_who_already_has_an_account_is_rejected(self, service, world):
        with pytest.raises(APIError) as caught:
            service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com', member_id=world.bob_member)
        assert caught.value.status == 422


class TestAcceptInvite:
    def test_joins_the_group_and_bumps_its_version(self, service, world):
        cy = world.users.add('Cy', 'cy@example.com')
        token = service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com')['inviteToken']
        group = service.accept_invite(str(cy.id), token)
        assert {m['name'] for m in group['members']} == {'Ada', 'Bob', 'Cy'}
        assert world.groups.rows[world.group_id].version == 2

    def test_a_code_cannot_be_used_twice(self, service, world):
        cy = world.users.add('Cy', 'cy@example.com')
        token = service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com')['inviteToken']
        service.accept_invite(str(cy.id), token)
        with pytest.raises(APIError) as caught:
            service.accept_invite(str(cy.id), token)
        assert caught.value.status == 404

    def test_the_code_belongs_to_one_email(self, service, world):
        token = service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com')['inviteToken']
        with pytest.raises(APIError) as caught:
            service.accept_invite(str(world.users.add('Eve', 'eve@example.com').id), token)
        assert caught.value.status == 403

    def test_an_expired_code_is_rejected(self, service, world):
        cy = world.users.add('Cy', 'cy@example.com')
        token = service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com')['inviteToken']
        for invitation in world.invitations.rows.values():
            invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(APIError) as caught:
            service.accept_invite(str(cy.id), token)
        assert caught.value.status == 404

    def test_accepting_for_a_person_links_them_to_the_account(self, service, world):
        sam = uuid4()
        world.members.insert_member(sam, world.group_id, None, 'Sam', None)
        cy = world.users.add('Cy', 'cy@example.com')
        token = service.invite(str(world.group_id), str(world.ada.id), 'cy@example.com', member_id=sam)['inviteToken']
        service.accept_invite(str(cy.id), token)
        assert world.members.rows[sam].user_id == cy.id
