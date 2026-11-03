from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Connection, Row, text
from sqlalchemy.dialects.postgresql import JSONB


# Everything but the receipt bytes, which only the receipt endpoint needs.
EXPENSE_COLUMNS = ('id, group_id, merchant, occurred_at, category, notes, amount_minor, payer_id, method, '
                   'allocations, input_values, version, updated_at, (receipt IS NOT NULL) AS has_receipt')


class GroupRepository:
    """SQL only. Rules, conflicts and payloads live in GroupService."""

    # --- groups and members -------------------------------------------------
    def is_member(self, db: Connection, group_id: UUID, user_id: UUID) -> bool:
        return db.execute(text('SELECT 1 FROM group_members WHERE group_id=:g AND user_id=:u'),
                          {'g': group_id, 'u': user_id}).fetchone() is not None

    def group(self, db: Connection, group_id: UUID, lock: bool = False) -> Row:
        sql = 'SELECT * FROM expense_groups WHERE id=:g' + (' FOR UPDATE' if lock else '')
        return db.execute(text(sql), {'g': group_id}).fetchone()

    def members(self, db: Connection, group_id: UUID) -> list[Row]:
        return db.execute(text('''SELECT u.id, u.name, u.email FROM users u JOIN group_members m ON m.user_id=u.id
                                  WHERE m.group_id=:g ORDER BY u.name, u.id'''), {'g': group_id}).fetchall()

    def member_ids(self, db: Connection, group_id: UUID) -> set[UUID]:
        rows = db.execute(text('SELECT user_id FROM group_members WHERE group_id=:g'), {'g': group_id}).fetchall()
        return {row.user_id for row in rows}

    def group_ids_for_user(self, db: Connection, user_id: UUID) -> list[UUID]:
        rows = db.execute(text('SELECT group_id FROM group_members WHERE user_id=:u ORDER BY group_id'),
                          {'u': user_id}).fetchall()
        return [row.group_id for row in rows]

    def insert_group(self, db: Connection, group_id: UUID, name: str, currency: str, owner: UUID,
                     created_at: datetime) -> None:
        db.execute(text('''INSERT INTO expense_groups (id, name, currency_code, owner_id, created_at, version)
                           VALUES (:id, :name, :currency, :owner, :created_at, 1)'''),
                   {'id': group_id, 'name': name, 'currency': currency, 'owner': owner, 'created_at': created_at})
        self.add_member(db, group_id, owner)

    def add_member(self, db: Connection, group_id: UUID, user_id: UUID) -> None:
        db.execute(text('INSERT INTO group_members (group_id, user_id) VALUES (:g, :u) ON CONFLICT DO NOTHING'),
                   {'g': group_id, 'u': user_id})

    def rename_group(self, db: Connection, group_id: UUID, name: str) -> None:
        db.execute(text('UPDATE expense_groups SET name=:name, version=version+1 WHERE id=:g'),
                   {'name': name, 'g': group_id})

    def bump_version(self, db: Connection, group_id: UUID) -> None:
        db.execute(text('UPDATE expense_groups SET version=version+1 WHERE id=:g'), {'g': group_id})

    # --- invitations --------------------------------------------------------
    def is_member_email(self, db: Connection, group_id: UUID, email: str) -> bool:
        return db.execute(text('''SELECT 1 FROM group_members gm JOIN users u ON u.id=gm.user_id
                                  WHERE gm.group_id=:g AND u.email=:email'''),
                          {'g': group_id, 'email': email}).fetchone() is not None

    def insert_invitation(self, db: Connection, token_hash: str, group_id: UUID, email: str, expires_at: datetime) -> None:
        db.execute(text('''INSERT INTO invitations (token_hash, group_id, email, expires_at, accepted_at)
                           VALUES (:h, :g, :email, :e, NULL)'''),
                   {'h': token_hash, 'g': group_id, 'email': email, 'e': expires_at})

    def invitation(self, db: Connection, token_hash: str) -> Row | None:
        return db.execute(text('SELECT * FROM invitations WHERE token_hash=:h FOR UPDATE'), {'h': token_hash}).fetchone()

    def accept_invitation(self, db: Connection, token_hash: str, accepted_at: datetime) -> None:
        db.execute(text('UPDATE invitations SET accepted_at=:t WHERE token_hash=:h'), {'t': accepted_at, 'h': token_hash})

    # --- expenses -----------------------------------------------------------
    def expenses(self, db: Connection, group_id: UUID) -> list[Row]:
        return db.execute(text(f'SELECT {EXPENSE_COLUMNS} FROM expenses WHERE group_id=:g ORDER BY occurred_at DESC, id'),
                          {'g': group_id}).fetchall()

    def expense(self, db: Connection, expense_id: UUID, lock: bool = False) -> Row | None:
        sql = f'SELECT {EXPENSE_COLUMNS} FROM expenses WHERE id=:id' + (' FOR UPDATE' if lock else '')
        return db.execute(text(sql), {'id': expense_id}).fetchone()

    _expense_columns = sa.text('''
        INSERT INTO expenses (id, group_id, merchant, occurred_at, category, notes, amount_minor, payer_id, method,
                              allocations, input_values, version, updated_at)
        VALUES (:id, :group_id, :merchant, :occurred_at, :category, :notes, :amount_minor, :payer_id, :method,
                :allocations, :input_values, :version, :updated_at)
    ''').bindparams(sa.bindparam('allocations', type_=JSONB), sa.bindparam('input_values', type_=JSONB))

    def insert_expense(self, db: Connection, values: dict) -> None:
        db.execute(self._expense_columns, values)

    _expense_update = sa.text('''
        UPDATE expenses SET merchant=:merchant, occurred_at=:occurred_at, category=:category, notes=:notes,
               amount_minor=:amount_minor, payer_id=:payer_id, method=:method, allocations=:allocations,
               input_values=:input_values, version=:version, updated_at=:updated_at
        WHERE id=:id
    ''').bindparams(sa.bindparam('allocations', type_=JSONB), sa.bindparam('input_values', type_=JSONB))

    def update_expense(self, db: Connection, values: dict) -> None:
        db.execute(self._expense_update, values)

    def delete_expense(self, db: Connection, group_id: UUID, expense_id: UUID, version: int) -> bool:
        result = db.execute(text('DELETE FROM expenses WHERE id=:id AND group_id=:g AND version=:v'),
                            {'id': expense_id, 'g': group_id, 'v': version})
        return result.rowcount == 1

    # --- settlements --------------------------------------------------------
    def settlements(self, db: Connection, group_id: UUID) -> list[Row]:
        return db.execute(text('SELECT * FROM settlements WHERE group_id=:g ORDER BY created_at DESC, id'),
                          {'g': group_id}).fetchall()

    def settlement(self, db: Connection, settlement_id: UUID) -> Row | None:
        return db.execute(text('SELECT * FROM settlements WHERE id=:id'), {'id': settlement_id}).fetchone()

    def insert_settlement(self, db: Connection, settlement_id: UUID, group_id: UUID, from_id: UUID, to_id: UUID,
                          amount: int, created_at: datetime) -> bool:
        result = db.execute(text('''INSERT INTO settlements (id, group_id, from_id, to_id, amount_minor, created_at)
                                    VALUES (:id, :g, :f, :t, :a, :c) ON CONFLICT (id) DO NOTHING'''),
                            {'id': settlement_id, 'g': group_id, 'f': from_id, 't': to_id, 'a': amount, 'c': created_at})
        return result.rowcount == 1

    # --- receipts -----------------------------------------------------------
    def set_receipt(self, db: Connection, group_id: UUID, expense_id: UUID, data: bytes | None, mime: str | None) -> bool:
        result = db.execute(text('UPDATE expenses SET receipt=:data, receipt_type=:mime WHERE id=:id AND group_id=:g'),
                            {'data': data, 'mime': mime, 'id': expense_id, 'g': group_id})
        return result.rowcount == 1

    def receipt(self, db: Connection, group_id: UUID, expense_id: UUID) -> Row | None:
        return db.execute(text('SELECT receipt, receipt_type FROM expenses WHERE id=:id AND group_id=:g'),
                          {'id': expense_id, 'g': group_id}).fetchone()
