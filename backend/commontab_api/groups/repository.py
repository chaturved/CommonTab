from __future__ import annotations

import hmac
import json
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from io import BytesIO
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

from ..accounts.repository import AccountRepository
from ..errors import fail
from ..database import AppDatabase
from .models import ExpenseInput, GroupInput, SettlementInput
from .rules import allocation, utc_timestamp


class GroupExpenseRepository:
    def __init__(self, db: AppDatabase, accounts: AccountRepository):
        self.db = db
        self.accounts = accounts

    def membership(self, db, group_id: str, user_id: str):
        row = db.execute('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?', (group_id, user_id)).fetchone()
        if row is None:
            fail(404, 'Group not found')

    def group(self, group_id: str, user_id: str) -> dict:
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            group = db.execute('SELECT * FROM expense_groups WHERE id=?', (group_id,)).fetchone()
            members = db.execute('''SELECT u.id, u.name, u.email FROM users u JOIN group_members m ON m.user_id=u.id
                                    WHERE m.group_id=? ORDER BY u.name, u.id''', (group_id,)).fetchall()
            expenses = db.execute('SELECT * FROM expenses WHERE group_id=? ORDER BY occurred_at DESC, id',
                                  (group_id,)).fetchall()
            settlements = db.execute('SELECT * FROM settlements WHERE group_id=? ORDER BY created_at DESC, id',
                                     (group_id,)).fetchall()
        balance = {member['id']: 0 for member in members}
        for expense in expenses:
            balance[expense['payer_id']] += expense['amount_minor']
            for share in json.loads(expense['allocations_json']):
                balance[share['memberID']] -= share['minorUnits']
        for settlement in settlements:
            balance[settlement['from_id']] += settlement['amount_minor']
            balance[settlement['to_id']] -= settlement['amount_minor']
        return {
            'id': group['id'], 'name': group['name'], 'currencyCode': group['currency_code'],
            'ownerID': group['owner_id'], 'version': group['version'],
            'members': [dict(member) for member in members],
            'expenses': [self.expense_payload(row) for row in expenses],
            'settlements': [self.settlement_payload(row) for row in settlements],
            'balances': [{'memberID': member['id'], 'minorUnits': balance[member['id']]} for member in members],
        }

    def groups(self, user_id: str) -> list[dict]:
        with self.db.connect() as db:
            rows = db.execute('SELECT group_id FROM group_members WHERE user_id=? ORDER BY group_id', (user_id,)).fetchall()
        return [self.group(row['group_id'], user_id) for row in rows]

    def create_group(self, user_id: str, input: GroupInput) -> dict:
        if not input.name.strip():
            fail(422, 'Group name is required')
        group_id = str(uuid4())
        with self.db.connect() as db:
            db.execute('INSERT INTO expense_groups VALUES (?, ?, ?, ?, ?, 1)',
                       (group_id, input.name.strip(), input.currency_code, user_id, int(time.time())))
            db.execute('INSERT INTO group_members VALUES (?, ?)', (group_id, user_id))
        return self.group(group_id, user_id)

    def rename_group(self, group_id: str, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Group name is required')
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            db.execute('UPDATE expense_groups SET name=?, version=version+1 WHERE id=?', (name.strip(), group_id))
        return self.group(group_id, user_id)

    def invite(self, group_id: str, user_id: str, email: str) -> dict:
        email = self.accounts.email(email)
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            member = db.execute('''SELECT 1 FROM group_members gm JOIN users u ON u.id=gm.user_id
                                   WHERE gm.group_id=? AND u.email=?''', (group_id, email)).fetchone()
            if member:
                fail(409, 'Already a member')
            token = secrets.token_urlsafe(32)
            expires = int(time.time()) + 7 * 24 * 3600
            db.execute('INSERT INTO invitations VALUES (?, ?, ?, ?, NULL)',
                       (self.accounts.token_hash(token), group_id, email, expires))
        return {'inviteToken': token, 'expiresAt': datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                'email': email, 'groupID': group_id}

    def accept_invite(self, user_id: str, token: str) -> dict:
        with self.db.connect() as db:
            row = db.execute('SELECT * FROM invitations WHERE token_hash=?', (self.accounts.token_hash(token),)).fetchone()
            email = db.execute('SELECT email FROM users WHERE id=?', (user_id,)).fetchone()['email']
            if row is None or row['expires_at'] <= int(time.time()) or row['accepted_at'] is not None:
                fail(404, 'Invitation missing or expired')
            if not hmac.compare_digest(row['email'], email):
                fail(403, 'Invitation belongs to a different email')
            db.execute('INSERT OR IGNORE INTO group_members VALUES (?, ?)', (row['group_id'], user_id))
            db.execute('UPDATE invitations SET accepted_at=? WHERE token_hash=?',
                       (int(time.time()), self.accounts.token_hash(token)))
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (row['group_id'],))
            group_id = row['group_id']
        return self.group(group_id, user_id)

    @staticmethod
    def expense_payload(row) -> dict:
        return {'id': row['id'], 'groupID': row['group_id'], 'merchant': row['merchant'],
                'occurredAt': row['occurred_at'], 'category': row['category'], 'notes': row['notes'],
                'amountMinor': row['amount_minor'], 'payerID': row['payer_id'], 'method': row['method'],
                'allocations': json.loads(row['allocations_json']), 'values': json.loads(row['values_json']),
                'version': row['version'],
                'hasReceipt': row['receipt'] is not None}

    @staticmethod
    def settlement_payload(row) -> dict:
        return {'id': row['id'], 'groupID': row['group_id'], 'fromID': row['from_id'],
                'toID': row['to_id'], 'amountMinor': row['amount_minor'],
                'createdAt': datetime.fromtimestamp(row['created_at'], timezone.utc).isoformat()}

    def save_expense(self, group_id: str, user_id: str, input: ExpenseInput) -> dict:
        occurred_at = utc_timestamp(input.occurred_at)
        if not input.merchant.strip():
            fail(422, 'Expense description is required')
        payer = str(input.payer_id)
        participants = [str(member) for member in input.participants]
        allocations = allocation(input.amount_minor, input.method, participants, input.values)
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            members = {row['user_id'] for row in db.execute('SELECT user_id FROM group_members WHERE group_id=?',
                                                              (group_id,)).fetchall()}
            if payer not in members or not set(participants).issubset(members):
                fail(422, 'Payer and participants must belong to the group')
            existing = db.execute('SELECT * FROM expenses WHERE id=?', (str(input.id),)).fetchone()
            if existing:
                if existing['group_id'] != group_id:
                    fail(409, 'Expense ID belongs to another group')
                if input.version != existing['version']:
                    fail(409, 'Expense changed; reload before saving')
                version = existing['version'] + 1
                db.execute('''UPDATE expenses SET merchant=?, occurred_at=?, category=?, notes=?, amount_minor=?,
                              payer_id=?, method=?, allocations_json=?, values_json=?, version=?, updated_at=? WHERE id=?''',
                           (input.merchant.strip(), occurred_at, input.category, input.notes,
                            input.amount_minor, payer, input.method, json.dumps(allocations),
                            json.dumps(input.values), version, int(time.time()), str(input.id)))
            else:
                if input.version is not None:
                    fail(409, 'Expense missing; reload before saving')
                version = 1
                db.execute('''INSERT INTO expenses (id, group_id, merchant, occurred_at, category, notes,
                              amount_minor, payer_id, method, allocations_json, values_json, version, updated_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                           (str(input.id), group_id, input.merchant.strip(), occurred_at, input.category,
                            input.notes, input.amount_minor, payer, input.method, json.dumps(allocations),
                            json.dumps(input.values), version, int(time.time())))
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
            row = db.execute('SELECT * FROM expenses WHERE id=?', (str(input.id),)).fetchone()
        return self.expense_payload(row)

    def delete_expense(self, group_id: str, expense_id: str, user_id: str, version: int):
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            cursor = db.execute('DELETE FROM expenses WHERE id=? AND group_id=? AND version=?',
                                (expense_id, group_id, version))
            if cursor.rowcount != 1:
                fail(409, 'Expense changed or missing; reload before deleting')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))

    def settle(self, group_id: str, user_id: str, input: SettlementInput) -> dict:
        group = self.group(group_id, user_id)
        from_id, to_id = str(input.from_id), str(input.to_id)
        if user_id not in (from_id, to_id):
            fail(403, 'Only a settlement participant may record it')
        balance = {item['memberID']: item['minorUnits'] for item in group['balances']}
        if from_id == to_id or from_id not in balance or to_id not in balance:
            fail(422, 'Settlement members must be different group members')
        if balance[from_id] >= 0 or balance[to_id] <= 0 or input.amount_minor > min(-balance[from_id], balance[to_id]):
            fail(422, 'Settlement exceeds outstanding balance')
        with self.db.connect() as db:
            current_version = db.execute('SELECT version FROM expense_groups WHERE id=?', (group_id,)).fetchone()['version']
            if current_version != input.group_version:
                fail(409, 'Group changed; reload before settling')
            try:
                db.execute('INSERT INTO settlements VALUES (?, ?, ?, ?, ?, ?)',
                           (str(input.id), group_id, from_id, to_id, input.amount_minor, int(time.time())))
            except sqlite3.IntegrityError:
                fail(409, 'Settlement ID already exists')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
            row = db.execute('SELECT * FROM settlements WHERE id=?', (str(input.id),)).fetchone()
        return self.settlement_payload(row)

    def put_receipt(self, group_id: str, expense_id: str, user_id: str, data: bytes, mime: str) -> dict:
        if mime not in ('image/jpeg', 'image/png') or not data or len(data) > 5 * 1024 * 1024:
            fail(422, 'Receipt must be a JPEG or PNG under 5 MB')
        if (mime == 'image/jpeg' and not data.startswith(b'\xff\xd8\xff')) or \
           (mime == 'image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n')):
            fail(422, 'Receipt content does not match its type')
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
        try:
            with Image.open(BytesIO(data)) as image:
                expected_format = 'JPEG' if mime == 'image/jpeg' else 'PNG'
                if image.format != expected_format or image.width * image.height > 20_000_000:
                    fail(422, 'Receipt image is invalid or too large')
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1800, 1800))
                if image.mode != 'RGB':
                    rgb = Image.new('RGB', image.size, 'white')
                    if image.mode in ('RGBA', 'LA'):
                        rgb.paste(image, mask=image.getchannel('A'))
                    else:
                        rgb.paste(image.convert('RGB'))
                    image = rgb
                output = BytesIO()
                image.save(output, format='JPEG', quality=80, optimize=True)
                data = output.getvalue()
        except (UnidentifiedImageError, OSError, ValueError):
            fail(422, 'Receipt image could not be decoded')
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            cursor = db.execute('UPDATE expenses SET receipt=?, receipt_type=? WHERE id=? AND group_id=?',
                                (data, 'image/jpeg', expense_id, group_id))
            if cursor.rowcount != 1:
                fail(404, 'Expense not found')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
        return {'hasReceipt': True}

    def get_receipt(self, group_id: str, expense_id: str, user_id: str) -> tuple[bytes, str]:
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            row = db.execute('SELECT receipt, receipt_type FROM expenses WHERE id=? AND group_id=?',
                             (expense_id, group_id)).fetchone()
        if row is None or row['receipt'] is None:
            fail(404, 'Receipt not found')
        return row['receipt'], row['receipt_type']

    def delete_receipt(self, group_id: str, expense_id: str, user_id: str):
        with self.db.connect() as db:
            self.membership(db, group_id, user_id)
            cursor = db.execute('UPDATE expenses SET receipt=NULL, receipt_type=NULL WHERE id=? AND group_id=?',
                                (expense_id, group_id))
            if cursor.rowcount != 1:
                fail(404, 'Expense not found')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
