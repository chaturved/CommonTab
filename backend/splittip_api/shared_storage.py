from __future__ import annotations

import hashlib
from io import BytesIO
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
from pathlib import Path
from uuid import UUID, uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

from .shared_models import AccountInput, ExpenseInput, GroupInput, SettlementInput


class SharedError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def fail(status: int, message: str):
    raise SharedError(status, message)


def utc_timestamp(value: str) -> str:
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if date.tzinfo is None:
            raise ValueError
        return date.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    except ValueError:
        fail(422, 'occurredAt must be an ISO 8601 timestamp with a timezone')


def allocation(amount: int, method: str, participants: list[str], values: list[str]) -> list[dict]:
    if method == 'equal':
        quotient, remainder = divmod(amount, len(participants))
        units = [quotient + (index < remainder) for index in range(len(participants))]
    else:
        try:
            numbers = [Decimal(value) for value in values]
        except InvalidOperation:
            fail(422, 'Invalid split value')
        if not all(number.is_finite() and number >= 0 for number in numbers):
            fail(422, 'Split values must be nonnegative and finite')
        if method == 'exact':
            if any(number != number.to_integral_value() for number in numbers):
                fail(422, 'Exact values must be integer minor units')
            units = [int(number) for number in numbers]
            if sum(units) != amount:
                fail(422, 'Exact shares must equal the expense amount')
        else:
            if sum(numbers) != 100:
                fail(422, 'Percentages must total 100')
            raw = [Decimal(amount) * number / 100 for number in numbers]
            units = [int(number.to_integral_value(rounding=ROUND_FLOOR)) for number in raw]
            order = sorted(range(len(units)), key=lambda index: (-(raw[index] - units[index]), index))
            for index in order[:amount - sum(units)]:
                units[index] += 1
    return [{'memberID': member, 'minorUnits': units[index]} for index, member in enumerate(participants)]


class SharedStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.passwords = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                    password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                    expires_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS expense_groups (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, currency_code TEXT NOT NULL,
                    owner_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS group_members (
                    group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    user_id TEXT NOT NULL REFERENCES users(id),
                    PRIMARY KEY (group_id, user_id)
                );
                CREATE TABLE IF NOT EXISTS invitations (
                    token_hash TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    email TEXT NOT NULL, expires_at INTEGER NOT NULL, accepted_at INTEGER
                );
                CREATE TABLE IF NOT EXISTS expenses (
                    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    merchant TEXT NOT NULL, occurred_at TEXT NOT NULL, category TEXT NOT NULL,
                    notes TEXT NOT NULL, amount_minor INTEGER NOT NULL,
                    payer_id TEXT NOT NULL REFERENCES users(id), method TEXT NOT NULL,
                    allocations_json TEXT NOT NULL, values_json TEXT NOT NULL, version INTEGER NOT NULL,
                    receipt BLOB, receipt_type TEXT, updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS expenses_group ON expenses(group_id);
                CREATE TABLE IF NOT EXISTS settlements (
                    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES expense_groups(id),
                    from_id TEXT NOT NULL REFERENCES users(id), to_id TEXT NOT NULL REFERENCES users(id),
                    amount_minor INTEGER NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS settlements_group ON settlements(group_id);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA journal_mode=WAL')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def token_hash(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def email(value: str) -> str:
        email = value.strip().lower()
        if len(email) > 254 or email.count('@') != 1 or not email.split('@')[0] or '.' not in email.split('@')[1]:
            fail(422, 'Invalid email address')
        return email

    @staticmethod
    def public_user(row: sqlite3.Row) -> dict:
        return {'id': row['id'], 'email': row['email'], 'name': row['name']}

    def register(self, input: AccountInput) -> dict:
        email = self.email(input.email)
        name = input.name.strip()
        if not name:
            fail(422, 'Name is required')
        user_id = str(uuid4())
        with self.connect() as db:
            try:
                db.execute('INSERT INTO users VALUES (?, ?, ?, ?, ?)',
                           (user_id, email, name, self.passwords.hash(input.password), int(time.time())))
            except sqlite3.IntegrityError:
                fail(409, 'An account with this email already exists')
        return self.login(email, input.password)

    def login(self, email: str, password: str) -> dict:
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE email=?', (self.email(email),)).fetchone()
            try:
                if row is None:
                    fail(401, 'Invalid credentials')
                self.passwords.verify(row['password_hash'], password)
            except (VerifyMismatchError, VerificationError):
                fail(401, 'Invalid credentials')
            token = secrets.token_urlsafe(32)
            expires = int(time.time()) + 30 * 24 * 3600
            db.execute('INSERT INTO auth_tokens VALUES (?, ?, ?)', (self.token_hash(token), row['id'], expires))
            return {'accessToken': token, 'expiresAt': datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                    'user': self.public_user(row)}

    def authenticate(self, token: str) -> str:
        with self.connect() as db:
            row = db.execute('SELECT user_id, expires_at FROM auth_tokens WHERE token_hash=?',
                             (self.token_hash(token),)).fetchone()
        if not row or row['expires_at'] <= int(time.time()):
            fail(401, 'Invalid or expired session')
        return row['user_id']

    def logout(self, token: str):
        with self.connect() as db:
            db.execute('DELETE FROM auth_tokens WHERE token_hash=?', (self.token_hash(token),))

    def me(self, user_id: str) -> dict:
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
        return self.public_user(row)

    def rename_me(self, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Name is required')
        with self.connect() as db:
            db.execute('UPDATE users SET name=? WHERE id=?', (name.strip(), user_id))
        return self.me(user_id)

    def membership(self, db, group_id: str, user_id: str):
        row = db.execute('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?', (group_id, user_id)).fetchone()
        if row is None:
            fail(404, 'Group not found')

    def group(self, group_id: str, user_id: str) -> dict:
        with self.connect() as db:
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
        with self.connect() as db:
            rows = db.execute('SELECT group_id FROM group_members WHERE user_id=? ORDER BY group_id', (user_id,)).fetchall()
        return [self.group(row['group_id'], user_id) for row in rows]

    def create_group(self, user_id: str, input: GroupInput) -> dict:
        if not input.name.strip():
            fail(422, 'Group name is required')
        group_id = str(uuid4())
        with self.connect() as db:
            db.execute('INSERT INTO expense_groups VALUES (?, ?, ?, ?, ?, 1)',
                       (group_id, input.name.strip(), input.currency_code, user_id, int(time.time())))
            db.execute('INSERT INTO group_members VALUES (?, ?)', (group_id, user_id))
        return self.group(group_id, user_id)

    def rename_group(self, group_id: str, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Group name is required')
        with self.connect() as db:
            self.membership(db, group_id, user_id)
            db.execute('UPDATE expense_groups SET name=?, version=version+1 WHERE id=?', (name.strip(), group_id))
        return self.group(group_id, user_id)

    def invite(self, group_id: str, user_id: str, email: str) -> dict:
        email = self.email(email)
        with self.connect() as db:
            self.membership(db, group_id, user_id)
            member = db.execute('''SELECT 1 FROM group_members gm JOIN users u ON u.id=gm.user_id
                                   WHERE gm.group_id=? AND u.email=?''', (group_id, email)).fetchone()
            if member:
                fail(409, 'Already a member')
            token = secrets.token_urlsafe(32)
            expires = int(time.time()) + 7 * 24 * 3600
            db.execute('INSERT INTO invitations VALUES (?, ?, ?, ?, NULL)',
                       (self.token_hash(token), group_id, email, expires))
        return {'inviteToken': token, 'expiresAt': datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                'email': email, 'groupID': group_id}

    def accept_invite(self, user_id: str, token: str) -> dict:
        with self.connect() as db:
            row = db.execute('SELECT * FROM invitations WHERE token_hash=?', (self.token_hash(token),)).fetchone()
            email = db.execute('SELECT email FROM users WHERE id=?', (user_id,)).fetchone()['email']
            if row is None or row['expires_at'] <= int(time.time()) or row['accepted_at'] is not None:
                fail(404, 'Invitation missing or expired')
            if not hmac.compare_digest(row['email'], email):
                fail(403, 'Invitation belongs to a different email')
            db.execute('INSERT OR IGNORE INTO group_members VALUES (?, ?)', (row['group_id'], user_id))
            db.execute('UPDATE invitations SET accepted_at=? WHERE token_hash=?',
                       (int(time.time()), self.token_hash(token)))
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
        with self.connect() as db:
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
        with self.connect() as db:
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
        with self.connect() as db:
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
        with self.connect() as db:
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
        with self.connect() as db:
            self.membership(db, group_id, user_id)
            cursor = db.execute('UPDATE expenses SET receipt=?, receipt_type=? WHERE id=? AND group_id=?',
                                (data, 'image/jpeg', expense_id, group_id))
            if cursor.rowcount != 1:
                fail(404, 'Expense not found')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
        return {'hasReceipt': True}

    def get_receipt(self, group_id: str, expense_id: str, user_id: str) -> tuple[bytes, str]:
        with self.connect() as db:
            self.membership(db, group_id, user_id)
            row = db.execute('SELECT receipt, receipt_type FROM expenses WHERE id=? AND group_id=?',
                             (expense_id, group_id)).fetchone()
        if row is None or row['receipt'] is None:
            fail(404, 'Receipt not found')
        return row['receipt'], row['receipt_type']

    def delete_receipt(self, group_id: str, expense_id: str, user_id: str):
        with self.connect() as db:
            self.membership(db, group_id, user_id)
            cursor = db.execute('UPDATE expenses SET receipt=NULL, receipt_type=NULL WHERE id=? AND group_id=?',
                                (expense_id, group_id))
            if cursor.rowcount != 1:
                fail(404, 'Expense not found')
            db.execute('UPDATE expense_groups SET version=version+1 WHERE id=?', (group_id,))
