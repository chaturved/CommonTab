from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.bill_sessions import BillSessionService

SESSION = str(uuid4())


def a_bill() -> dict:
    person = str(uuid4())
    return {'people': [{'id': person, 'name': 'Alex'}],
            'items': [{'id': str(uuid4()), 'name': 'Pasta', 'price': '19.99', 'assignedPersonIDs': [person]}],
            'tax': '1.60', 'tipPercentage': '18', 'receiptTotal': '21.59'}


class TestBillSessionsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=BillSessionService)
        overrides[BillSessionService] = lambda: self.service

    def test_creating_needs_no_login_and_is_201(self):
        self.service.create.return_value = {'id': SESSION, 'accessToken': 't', 'version': 1,
                                            'expiresAt': '2026-10-07T00:00:00+00:00', 'bill': a_bill()}

        response = self.client.post('/v1/sessions', json={'bill': a_bill()})

        assert response.status_code == 201 and response.json()['accessToken'] == 't'

    def test_an_item_assigned_to_nobody_known_is_422(self):
        bill = a_bill()
        bill['items'][0]['assignedPersonIDs'] = [str(uuid4())]

        assert self.client.post('/v1/sessions', json={'bill': bill}).status_code == 422
        self.service.create.assert_not_called()

    def test_reading_needs_the_session_secret_as_a_bearer_token(self):
        assert self.client.get(f'/v1/sessions/{SESSION}').status_code == 401
        self.service.get.assert_not_called()

    def test_reading_passes_the_session_and_secret(self):
        self.service.get.return_value = {'id': SESSION, 'version': 1, 'expiresAt': 'x', 'bill': a_bill()}

        response = self.client.get(f'/v1/sessions/{SESSION}', headers={'Authorization': 'Bearer secret'})

        assert response.status_code == 200
        assert self.service.get.call_args.args[1] == 'secret'

    def test_updating_passes_the_version_and_bill(self):
        self.service.update.return_value = {'id': SESSION, 'version': 2, 'expiresAt': 'x', 'bill': a_bill()}

        response = self.client.put(f'/v1/sessions/{SESSION}', headers={'Authorization': 'Bearer secret'},
                                   json={'version': 1, 'bill': a_bill()})

        assert response.status_code == 200
        assert self.service.update.call_args.args[2] == 1
