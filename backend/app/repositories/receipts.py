from __future__ import annotations

from uuid import UUID

from sqlalchemy import Connection, Row, text

from app.core.db import DbConnection


class ReceiptRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def set_receipt(self, group_id: UUID, expense_id: UUID, data: bytes | None, mime: str | None) -> bool:
        result = self.connection.execute(text('''UPDATE expenses SET receipt=:data, receipt_type=:mime
                                    WHERE id=:id AND group_id=:g AND deleted_at IS NULL'''),
                            {'data': data, 'mime': mime, 'id': expense_id, 'g': group_id})
        return result.rowcount == 1

    def receipt(self, group_id: UUID, expense_id: UUID) -> Row | None:
        return self.connection.execute(text('''SELECT receipt, receipt_type FROM expenses
                                  WHERE id=:id AND group_id=:g AND deleted_at IS NULL'''),
                          {'id': expense_id, 'g': group_id}).fetchone()
