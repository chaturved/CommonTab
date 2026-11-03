from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.invitations import InvitationService
from conftest import USER_ID

GROUP = str(uuid4())


class TestInvitationsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=InvitationService)
        overrides[InvitationService] = lambda: self.service

    def test_inviting_is_201_and_passes_the_email_and_person(self):
        person = uuid4()
        self.service.invite.return_value = {'inviteToken': 't'}

        response = self.client.post(f'/v1/groups/{GROUP}/invitations',
                                    json={'email': 'cy@example.com', 'memberID': str(person)})

        assert (response.status_code, response.json()) == (201, {'inviteToken': 't'})
        self.service.invite.assert_called_once_with(GROUP, USER_ID, 'cy@example.com', person)

    def test_an_email_that_is_too_short_is_422(self):
        assert self.client.post(f'/v1/groups/{GROUP}/invitations', json={'email': 'a'}).status_code == 422

    def test_accepting_passes_the_code(self):
        self.service.accept_invite.return_value = {'id': GROUP}

        response = self.client.post('/v1/invitations/accept', json={'inviteToken': 'code'})

        assert response.status_code == 200
        self.service.accept_invite.assert_called_once_with(USER_ID, 'code')
