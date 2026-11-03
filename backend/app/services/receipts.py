from __future__ import annotations

from uuid import UUID

from app.core.errors import fail
from app.domain.limits import MAX_RECEIPT_BYTES
from app.repositories.groups import GroupRepository
from app.repositories.receipts import ReceiptRepository
from app.services.access import MembershipGuard
from app.services.receipt_images import ReceiptImageProcessor


class ReceiptService:
    def __init__(self, receipts: ReceiptRepository, groups: GroupRepository, guard: MembershipGuard,
                 images: ReceiptImageProcessor):
        self.receipts = receipts
        self.groups = groups
        self.guard = guard
        self.images = images

    def put_receipt(self, group_id: str, expense_id: str, user_id: str, data: bytes, mime: str) -> dict:
        if mime not in ('image/jpeg', 'image/png') or not data or len(data) > MAX_RECEIPT_BYTES:
            fail(422, 'Receipt must be a JPEG or PNG under 5 MB')
        if (mime == 'image/jpeg' and not data.startswith(b'\xff\xd8\xff')) or \
           (mime == 'image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n')):
            fail(422, 'Receipt content does not match its type')
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        data = self.images.normalize(data, mime)
        if not self.receipts.set_receipt(gid, UUID(expense_id), data, 'image/jpeg'):
            fail(404, 'Expense not found')
        self.groups.bump_version(gid)
        return {'hasReceipt': True}

    def get_receipt(self, group_id: str, expense_id: str, user_id: str) -> tuple[bytes, str]:
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        row = self.receipts.receipt(gid, UUID(expense_id))
        if row is None or row.receipt is None:
            fail(404, 'Receipt not found')
        return bytes(row.receipt), row.receipt_type

    def delete_receipt(self, group_id: str, expense_id: str, user_id: str) -> None:
        gid = UUID(group_id)
        self.guard.require(gid, UUID(user_id))
        if not self.receipts.set_receipt(gid, UUID(expense_id), None, None):
            fail(404, 'Expense not found')
        self.groups.bump_version(gid)
