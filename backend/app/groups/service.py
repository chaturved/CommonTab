from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import UUID, uuid4

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import Connection, Row

from ..accounts.service import AccountService
from ..core.db import Database
from ..errors import fail
from .models import ExpenseInput, GroupInput, SettlementInput
from .repository import GroupRepository
from .rules import allocation, balances, format_utc, parse_utc

INVITE_LIFETIME = timedelta(days=7)
MAX_RECEIPT_BYTES = 5 * 1024 * 1024


class GroupService:
    def __init__(self, db: Database, accounts: AccountService, repository: GroupRepository | None = None):
        self.db = db
        self.accounts = accounts
        self.repository = repository or GroupRepository()

    # --- reading ------------------------------------------------------------
    def require_member(self, db: Connection, group_id: UUID, user_id: UUID) -> None:
        if not self.repository.is_member(db, group_id, user_id):
            fail(404, 'Group not found')

    def snapshot(self, db: Connection, group_id: UUID) -> dict:
        group = self.repository.group(db, group_id)
        members = self.repository.members(db, group_id)
        expenses = [self.expense_payload(row) for row in self.repository.expenses(db, group_id)]
        settlements = [self.settlement_payload(row) for row in self.repository.settlements(db, group_id)]
        member_ids = [str(member.id) for member in members]
        return {
            'id': str(group.id), 'name': group.name, 'currencyCode': group.currency_code,
            'ownerID': str(group.owner_id), 'version': group.version,
            'members': [{'id': str(m.id), 'name': m.name, 'email': m.email} for m in members],
            'expenses': expenses, 'settlements': settlements,
            'balances': balances(member_ids, expenses, settlements),
        }

    def group(self, group_id: str, user_id: str) -> dict:
        gid, uid = UUID(group_id), UUID(user_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, uid)
            return self.snapshot(db, gid)

    def groups(self, user_id: str) -> list[dict]:
        uid = UUID(user_id)
        with self.db.transaction() as db:
            return [self.snapshot(db, gid) for gid in self.repository.group_ids_for_user(db, uid)]

    # --- groups, invitations ------------------------------------------------
    def create_group(self, user_id: str, input: GroupInput) -> dict:
        if not input.name.strip():
            fail(422, 'Group name is required')
        group_id = uuid4()
        with self.db.transaction() as db:
            self.repository.insert_group(db, group_id, input.name.strip(), input.currency_code, UUID(user_id),
                                         datetime.now(timezone.utc))
            return self.snapshot(db, group_id)

    def rename_group(self, group_id: str, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Group name is required')
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            self.repository.rename_group(db, gid, name.strip())
            return self.snapshot(db, gid)

    def invite(self, group_id: str, user_id: str, email: str) -> dict:
        email = self.accounts.email(email)
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            if self.repository.is_member_email(db, gid, email):
                fail(409, 'Already a member')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + INVITE_LIFETIME
            self.repository.insert_invitation(db, self.accounts.token_hash(token), gid, email, expires)
        return {'inviteToken': token, 'expiresAt': expires.isoformat(), 'email': email, 'groupID': group_id}

    def accept_invite(self, user_id: str, token: str) -> dict:
        uid = UUID(user_id)
        with self.db.transaction() as db:
            token_hash = self.accounts.token_hash(token)
            row = self.repository.invitation(db, token_hash)
            email = self.accounts.email_of(db, uid)
            now = datetime.now(timezone.utc)
            if row is None or row.expires_at <= now or row.accepted_at is not None:
                fail(404, 'Invitation missing or expired')
            if not hmac.compare_digest(row.email, email):
                fail(403, 'Invitation belongs to a different email')
            self.repository.add_member(db, row.group_id, uid)
            self.repository.accept_invitation(db, token_hash, now)
            self.repository.bump_version(db, row.group_id)
            return self.snapshot(db, row.group_id)

    # --- payloads -----------------------------------------------------------
    @staticmethod
    def expense_payload(row: Row) -> dict:
        return {'id': str(row.id), 'groupID': str(row.group_id), 'merchant': row.merchant,
                'occurredAt': format_utc(row.occurred_at), 'category': row.category, 'notes': row.notes,
                'amountMinor': row.amount_minor, 'payerID': str(row.payer_id), 'method': row.method,
                'allocations': row.allocations, 'values': row.input_values, 'version': row.version,
                'hasReceipt': row.has_receipt}

    @staticmethod
    def settlement_payload(row: Row) -> dict:
        return {'id': str(row.id), 'groupID': str(row.group_id), 'fromID': str(row.from_id),
                'toID': str(row.to_id), 'amountMinor': row.amount_minor, 'createdAt': row.created_at.isoformat()}

    # --- expenses -----------------------------------------------------------
    def save_expense(self, group_id: str, user_id: str, input: ExpenseInput) -> dict:
        occurred_at = parse_utc(input.occurred_at)
        if not input.merchant.strip():
            fail(422, 'Expense description is required')
        gid, uid = UUID(group_id), UUID(user_id)
        participants = [str(member) for member in input.participants]
        allocations = allocation(input.amount_minor, input.method, participants, input.values)
        with self.db.transaction() as db:
            self.require_member(db, gid, uid)
            members = self.repository.member_ids(db, gid)
            if input.payer_id not in members or not set(input.participants).issubset(members):
                fail(422, 'Payer and participants must belong to the group')
            existing = self.repository.expense(db, input.id, lock=True)
            values = {
                'id': input.id, 'group_id': gid, 'merchant': input.merchant.strip(), 'occurred_at': occurred_at,
                'category': input.category, 'notes': input.notes, 'amount_minor': input.amount_minor,
                'payer_id': input.payer_id, 'method': input.method, 'allocations': allocations,
                'input_values': input.values, 'updated_at': datetime.now(timezone.utc),
            }
            if existing:
                if existing.group_id != gid:
                    fail(409, 'Expense ID belongs to another group')
                if input.version != existing.version:
                    fail(409, 'Expense changed; reload before saving')
                self.repository.update_expense(db, {**values, 'version': existing.version + 1})
            else:
                if input.version is not None:
                    fail(409, 'Expense missing; reload before saving')
                self.repository.insert_expense(db, {**values, 'version': 1})
            self.repository.bump_version(db, gid)
            return self.expense_payload(self.repository.expense(db, input.id))

    def delete_expense(self, group_id: str, expense_id: str, user_id: str, version: int) -> None:
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            if not self.repository.delete_expense(db, gid, UUID(expense_id), version):
                fail(409, 'Expense changed or missing; reload before deleting')
            self.repository.bump_version(db, gid)

    # --- settlements --------------------------------------------------------
    def settle(self, group_id: str, user_id: str, input: SettlementInput) -> dict:
        gid, uid = UUID(group_id), UUID(user_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, uid)
            # Serialize writers on this group so two payments cannot both pass the balance check.
            self.repository.group(db, gid, lock=True)
            group = self.snapshot(db, gid)
            from_id, to_id = str(input.from_id), str(input.to_id)
            if user_id not in (from_id, to_id):
                fail(403, 'Only a settlement participant may record it')
            balance = {item['memberID']: item['minorUnits'] for item in group['balances']}
            if from_id == to_id or from_id not in balance or to_id not in balance:
                fail(422, 'Settlement members must be different group members')
            if balance[from_id] >= 0 or balance[to_id] <= 0 or input.amount_minor > min(-balance[from_id], balance[to_id]):
                fail(422, 'Settlement exceeds outstanding balance')
            if group['version'] != input.group_version:
                fail(409, 'Group changed; reload before settling')
            if not self.repository.insert_settlement(db, input.id, gid, input.from_id, input.to_id,
                                                     input.amount_minor, datetime.now(timezone.utc)):
                fail(409, 'Settlement ID already exists')
            self.repository.bump_version(db, gid)
            return self.settlement_payload(self.repository.settlement(db, input.id))

    # --- receipts -----------------------------------------------------------
    def put_receipt(self, group_id: str, expense_id: str, user_id: str, data: bytes, mime: str) -> dict:
        if mime not in ('image/jpeg', 'image/png') or not data or len(data) > MAX_RECEIPT_BYTES:
            fail(422, 'Receipt must be a JPEG or PNG under 5 MB')
        if (mime == 'image/jpeg' and not data.startswith(b'\xff\xd8\xff')) or \
           (mime == 'image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n')):
            fail(422, 'Receipt content does not match its type')
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
        data = self.normalized_jpeg(data, mime)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            if not self.repository.set_receipt(db, gid, UUID(expense_id), data, 'image/jpeg'):
                fail(404, 'Expense not found')
            self.repository.bump_version(db, gid)
        return {'hasReceipt': True}

    @staticmethod
    def normalized_jpeg(data: bytes, mime: str) -> bytes:
        """Decode, cap the size, drop metadata and re-encode as JPEG."""
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
                return output.getvalue()
        except (UnidentifiedImageError, OSError, ValueError):
            fail(422, 'Receipt image could not be decoded')

    def get_receipt(self, group_id: str, expense_id: str, user_id: str) -> tuple[bytes, str]:
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            row = self.repository.receipt(db, gid, UUID(expense_id))
        if row is None or row.receipt is None:
            fail(404, 'Receipt not found')
        return bytes(row.receipt), row.receipt_type

    def delete_receipt(self, group_id: str, expense_id: str, user_id: str) -> None:
        gid = UUID(group_id)
        with self.db.transaction() as db:
            self.require_member(db, gid, UUID(user_id))
            if not self.repository.set_receipt(db, gid, UUID(expense_id), None, None):
                fail(404, 'Expense not found')
            self.repository.bump_version(db, gid)
