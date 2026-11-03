from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.deps import current_user
from app.core.errors import APIError
from app.services.groups import GroupService
from conftest import USER_ID

GROUP = str(uuid4())


class TestGroupsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.overrides = overrides
        self.service = MagicMock(spec_set=GroupService)
        overrides[GroupService] = lambda: self.service

    def test_creating_a_group_is_201_and_passes_the_signed_in_account(self):
        self.service.create_group.return_value = ({'id': GROUP}, True)

        response = self.client.post('/v1/groups', json={'name': 'Trip', 'currencyCode': 'USD'})

        assert (response.status_code, response.json()) == (201, {'id': GROUP})
        assert self.service.create_group.call_args.args[0] == USER_ID
        assert self.service.create_group.call_args.args[1].name == 'Trip'

    def test_repeating_a_create_is_200_not_201(self):
        self.service.create_group.return_value = ({'id': GROUP}, False)

        response = self.client.post('/v1/groups', json={'name': 'Trip', 'currencyCode': 'USD'})

        assert response.status_code == 200

    @pytest.mark.parametrize('body', [
        {'name': '', 'currencyCode': 'USD'},
        {'name': 'Trip', 'currencyCode': 'XYZ'},
        {'currencyCode': 'USD'},
    ])
    def test_an_invalid_group_is_422_and_never_reaches_the_service(self, body):
        response = self.client.post('/v1/groups', json=body)

        assert response.status_code == 422
        self.service.create_group.assert_not_called()

    def test_listing_returns_the_services_groups(self):
        self.service.list_groups.return_value = [{'id': GROUP}]

        response = self.client.get('/v1/groups')

        assert response.json() == [{'id': GROUP}]
        self.service.list_groups.assert_called_once_with(USER_ID)

    def test_reading_a_group_passes_its_id_as_text(self):
        self.service.group.return_value = {'id': GROUP}

        self.client.get(f'/v1/groups/{GROUP}')

        self.service.group.assert_called_once_with(GROUP, USER_ID)

    def test_a_group_id_that_is_not_a_uuid_is_422(self):
        assert self.client.get('/v1/groups/not-a-uuid').status_code == 422

    def test_renaming_passes_the_new_name(self):
        self.service.rename_group.return_value = {'id': GROUP}

        self.client.patch(f'/v1/groups/{GROUP}', json={'name': 'Spain'})

        self.service.rename_group.assert_called_once_with(GROUP, USER_ID, 'Spain')

    def test_putting_a_member_passes_both_ids_and_the_name(self):
        member = str(uuid4())
        self.service.put_member.return_value = {'id': member}

        response = self.client.put(f'/v1/groups/{GROUP}/members/{member}', json={'name': 'Sam'})

        assert response.status_code == 200
        self.service.put_member.assert_called_once_with(GROUP, member, USER_ID, 'Sam')

    def test_an_api_error_becomes_json_with_its_status_code_and_extra_fields(self):
        self.service.group.side_effect = APIError(409, 'Taken', 'id_conflict', {'hint': 'x'})

        response = self.client.get(f'/v1/groups/{GROUP}')

        assert response.status_code == 409
        assert response.json() == {'detail': 'Taken', 'code': 'id_conflict', 'hint': 'x'}

    def test_without_a_bearer_token_every_group_route_is_401(self):
        del self.overrides[current_user]

        assert self.client.get('/v1/groups').status_code == 401
        self.service.list_groups.assert_not_called()
