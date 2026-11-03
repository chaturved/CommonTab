from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.errors import APIError
from app.domain.limits import MAX_RECEIPT_BYTES
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.receipts import ReceiptRepository
from app.services.access import MembershipGuard
from app.services.receipt_images import ReceiptImageProcessor
from app.services.receipts import ReceiptService
from rows import member_row

JPEG = b'\xff\xd8\xff' + b'x' * 10
PNG = b'\x89PNG\r\n\x1a\n' + b'x' * 10


class TestReceiptService:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.receipts = MagicMock(spec_set=ReceiptRepository)
        self.groups = MagicMock(spec_set=GroupRepository)
        self.members = MagicMock(spec_set=MemberRepository)
        self.images = MagicMock(spec_set=ReceiptImageProcessor)
        self.me = member_row()
        self.group_id, self.user_id, self.expense_id = self.me.group_id, self.me.user_id, uuid4()
        self.members.member_of.return_value = self.me
        self.images.normalize.return_value = b'normalized'
        self.receipts.set_receipt.return_value = True
        self.service = ReceiptService(self.receipts, self.groups, MembershipGuard(self.members), self.images)

    def put(self, data=JPEG, mime='image/jpeg'):
        return self.service.put_receipt(str(self.group_id), str(self.expense_id), str(self.user_id), data, mime)


    def test_a_valid_jpeg_is_normalized_stored_and_bumps_the_group(self):
        assert self.put() == {'hasReceipt': True}

        self.images.normalize.assert_called_once_with(JPEG, 'image/jpeg')
        self.receipts.set_receipt.assert_called_once_with(self.group_id, self.expense_id, b'normalized', 'image/jpeg')
        self.groups.bump_version.assert_called_once_with(self.group_id)

    def test_a_png_is_accepted_too(self):
        assert self.put(PNG, 'image/png') == {'hasReceipt': True}

    @pytest.mark.parametrize('data, mime', [
        (JPEG, 'text/plain'),
        (b'', 'image/jpeg'),
        (b'x' * (MAX_RECEIPT_BYTES + 1), 'image/jpeg'),
        (PNG, 'image/jpeg'),
        (JPEG, 'image/png'),
    ])
    def test_a_wrong_size_type_or_signature_is_rejected(self, data, mime):
        with pytest.raises(APIError) as caught:
            self.put(data, mime)

        assert caught.value.status == 422
        self.receipts.set_receipt.assert_not_called()

    def test_an_outsider_cannot_upload(self):
        self.members.member_of.return_value = None

        with pytest.raises(APIError) as caught:
            self.put()

        assert caught.value.status == 404

    def test_an_expense_that_is_missing_or_deleted_is_404(self):
        self.receipts.set_receipt.return_value = False

        with pytest.raises(APIError) as caught:
            self.put()

        assert caught.value.status == 404
        self.groups.bump_version.assert_not_called()


    def test_reading_returns_the_bytes_and_type(self):
        self.receipts.receipt.return_value = MagicMock(receipt=memoryview(b'jpeg'), receipt_type='image/jpeg')

        data, mime = self.service.get_receipt(str(self.group_id), str(self.expense_id), str(self.user_id))

        assert (data, mime) == (b'jpeg', 'image/jpeg')

    @pytest.mark.parametrize('row', [None, MagicMock(receipt=None, receipt_type=None)])
    def test_reading_an_expense_without_a_receipt_is_404(self, row):
        self.receipts.receipt.return_value = row

        with pytest.raises(APIError) as caught:
            self.service.get_receipt(str(self.group_id), str(self.expense_id), str(self.user_id))

        assert caught.value.status == 404

    def test_deleting_clears_the_receipt_and_bumps_the_group(self):
        self.service.delete_receipt(str(self.group_id), str(self.expense_id), str(self.user_id))

        self.receipts.set_receipt.assert_called_once_with(self.group_id, self.expense_id, None, None)
        self.groups.bump_version.assert_called_once_with(self.group_id)
