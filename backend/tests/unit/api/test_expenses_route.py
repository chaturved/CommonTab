from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.expenses import ExpenseService
from conftest import USER_ID

GROUP = str(uuid4())


def body(expense_id: str, **changes) -> dict:
    payer = str(uuid4())
    return {'id': expense_id, 'merchant': 'Dinner', 'occurredAt': '2026-09-30T12:00:00Z', 'amountMinor': 1001,
            'payerID': payer, 'method': 'equal', 'participants': [payer], **changes}


class TestExpensesRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=ExpenseService)
        overrides[ExpenseService] = lambda: self.service

    def test_saving_passes_the_group_the_account_and_the_input(self):
        expense_id = str(uuid4())
        self.service.save_expense.return_value = {'id': expense_id}

        response = self.client.put(f'/v1/groups/{GROUP}/expenses/{expense_id}', json=body(expense_id))

        assert (response.status_code, response.json()) == (200, {'id': expense_id})
        args = self.service.save_expense.call_args.args
        assert args[:2] == (GROUP, USER_ID) and str(args[2].id) == expense_id

    def test_an_id_in_the_body_that_differs_from_the_url_is_422(self):
        response = self.client.put(f'/v1/groups/{GROUP}/expenses/{uuid4()}', json=body(str(uuid4())))

        assert response.status_code == 422
        self.service.save_expense.assert_not_called()

    @pytest.mark.parametrize('changes', [{'amountMinor': 0}, {'method': 'weird'}, {'participants': []},
                                         {'method': 'exact', 'values': []}])
    def test_an_invalid_expense_is_422(self, changes):
        expense_id = str(uuid4())

        response = self.client.put(f'/v1/groups/{GROUP}/expenses/{expense_id}', json=body(expense_id, **changes))

        assert response.status_code == 422
        self.service.save_expense.assert_not_called()

    def test_deleting_is_204_and_ignores_the_old_version_parameter(self):
        expense_id = str(uuid4())

        response = self.client.delete(f'/v1/groups/{GROUP}/expenses/{expense_id}?version=3')

        assert (response.status_code, response.content) == (204, b'')
        self.service.delete_expense.assert_called_once_with(GROUP, expense_id, USER_ID)

    def test_a_version_below_one_is_422(self):
        assert self.client.delete(f'/v1/groups/{GROUP}/expenses/{uuid4()}?version=0').status_code == 422
