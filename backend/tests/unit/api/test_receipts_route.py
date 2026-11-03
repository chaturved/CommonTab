from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.domain.limits import MAX_RECEIPT_BYTES
from app.services.receipts import ReceiptService
from conftest import USER_ID

GROUP, EXPENSE = str(uuid4()), str(uuid4())
URL = f'/v1/groups/{GROUP}/expenses/{EXPENSE}/receipt'


class TestReceiptsRoute:
    @pytest.fixture(autouse=True)
    def setup(self, client, overrides) -> None:
        self.client = client
        self.service = MagicMock(spec_set=ReceiptService)
        overrides[ReceiptService] = lambda: self.service

    def test_uploading_passes_the_raw_body_and_its_content_type(self):
        self.service.put_receipt.return_value = {'hasReceipt': True}

        response = self.client.put(URL, content=b'image-bytes', headers={'Content-Type': 'image/jpeg'})

        assert (response.status_code, response.json()) == (200, {'hasReceipt': True})
        self.service.put_receipt.assert_called_once_with(GROUP, EXPENSE, USER_ID, b'image-bytes', 'image/jpeg')

    def test_a_declared_size_over_the_limit_is_413_before_the_body_is_read(self):
        response = self.client.put(URL, content=b'x', headers={'Content-Length': str(MAX_RECEIPT_BYTES + 1),
                                                                 'Content-Type': 'image/jpeg'})

        assert response.status_code in (400, 413)
        self.service.put_receipt.assert_not_called()

    def test_reading_returns_the_image_and_is_never_cached(self):
        self.service.get_receipt.return_value = (b'jpeg-bytes', 'image/jpeg')

        response = self.client.get(URL)

        assert (response.content, response.headers['content-type']) == (b'jpeg-bytes', 'image/jpeg')
        assert response.headers['cache-control'] == 'private, no-store'

    def test_deleting_is_204(self):
        response = self.client.delete(URL)

        assert (response.status_code, response.content) == (204, b'')
        self.service.delete_receipt.assert_called_once_with(GROUP, EXPENSE, USER_ID)
