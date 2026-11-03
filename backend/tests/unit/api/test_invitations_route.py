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

    def test_making_a_code_is_201_and_passes_the_person(self):
        person = uuid4()
        self.service.create_code.return_value = {'code': 'ABCD-2345'}

        response = self.client.post(f'/v1/groups/{GROUP}/invite-code', json={'memberID': str(person)})

        assert (response.status_code, response.json()) == (201, {'code': 'ABCD-2345'})
        self.service.create_code.assert_called_once_with(GROUP, USER_ID, person)

    def test_making_a_code_for_the_whole_group_needs_no_body_fields(self):
        self.service.create_code.return_value = {'code': 'ABCD-2345'}

        assert self.client.post(f'/v1/groups/{GROUP}/invite-code', json={}).status_code == 201
        self.service.create_code.assert_called_once_with(GROUP, USER_ID, None)

    def test_joining_passes_the_typed_code(self):
        self.service.join_with_code.return_value = {'id': GROUP}

        response = self.client.post('/v1/invitations/join', json={'code': 'abcd 2345'})

        assert (response.status_code, response.json()) == (200, {'id': GROUP})
        self.service.join_with_code.assert_called_once_with(USER_ID, 'abcd 2345')

    @pytest.mark.parametrize('body', [{}, {'code': ''}, {'code': 'x' * 33}])
    def test_joining_without_a_usable_code_is_422(self, body):
        assert self.client.post('/v1/invitations/join', json=body).status_code == 422
        self.service.join_with_code.assert_not_called()
