from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Connection, Row, text
from sqlalchemy.dialects.postgresql import JSONB

from app.core.db import DbConnection


EXPENSE_COLUMNS = ('id, group_id, merchant, occurred_at, category, notes, amount_minor, payer_id, method, '
                   'allocations, input_values, version, updated_at, deleted_at, currency_code, original_minor, rate_micros, '
                   '(receipt IS NOT NULL) AS has_receipt')


class ExpenseRepository:
    def __init__(self, connection: Connection = DbConnection):
        self.connection = connection

    def expenses(self, group_id: UUID) -> list[Row]:
        return self.connection.execute(text(f'SELECT {EXPENSE_COLUMNS} FROM expenses WHERE group_id=:g ORDER BY occurred_at DESC, id'),
                          {'g': group_id}).fetchall()

    def expense(self, expense_id: UUID, lock: bool = False) -> Row | None:
        sql = f'SELECT {EXPENSE_COLUMNS} FROM expenses WHERE id=:id' + (' FOR UPDATE' if lock else '')
        return self.connection.execute(text(sql), {'id': expense_id}).fetchone()

    _expense_columns = sa.text('''
        INSERT INTO expenses (id, group_id, merchant, occurred_at, category, notes, amount_minor, payer_id, method,
                              allocations, input_values, version, updated_at, currency_code, original_minor, rate_micros)
        VALUES (:id, :group_id, :merchant, :occurred_at, :category, :notes, :amount_minor, :payer_id, :method,
                :allocations, :input_values, :version, :updated_at, :currency_code, :original_minor, :rate_micros)
    ''').bindparams(sa.bindparam('allocations', type_=JSONB), sa.bindparam('input_values', type_=JSONB))

    def insert_expense(self, values: dict) -> None:
        self.connection.execute(self._expense_columns, values)

    _expense_update = sa.text('''
        UPDATE expenses SET merchant=:merchant, occurred_at=:occurred_at, category=:category, notes=:notes,
               amount_minor=:amount_minor, payer_id=:payer_id, method=:method, allocations=:allocations,
               input_values=:input_values, version=:version, updated_at=:updated_at, deleted_at=:deleted_at,
               currency_code=:currency_code, original_minor=:original_minor, rate_micros=:rate_micros
        WHERE id=:id
    ''').bindparams(sa.bindparam('allocations', type_=JSONB), sa.bindparam('input_values', type_=JSONB))

    def update_expense(self, values: dict) -> None:
        self.connection.execute(self._expense_update, values)

    def tombstone_expense(self, expense_id: UUID, now: datetime) -> None:
        self.connection.execute(text('UPDATE expenses SET deleted_at=:now, updated_at=:now, version=version+1 WHERE id=:id'),
                   {'now': now, 'id': expense_id})
