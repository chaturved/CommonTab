from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import UUID, uuid4

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import Row

from app.core.security import hash_token
from app.domain.emails import normalize_email
from app.repositories.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.core.errors import fail
from app.schemas.groups import ExpenseInput, GroupInput, SettlementInput
from app.domain.rules import allocation, balances, format_utc, parse_utc

INVITE_LIFETIME = timedelta(days=7)
MAX_RECEIPT_BYTES = 5 * 1024 * 1024


class GroupService:
    def __init__(self, uow: UnitOfWorkFactory):
        self.uow = uow

    # --- reading ------------------------------------------------------------
    def require_member(self, uow: UnitOfWork, group_id: UUID, user_id: UUID) -> Row:
        """The member linked to this account. Accounts that are not in the group get 404 (it may not exist)."""
        me = uow.groups.member_of(group_id, user_id)
        if me is None:
            fail(404, 'Group not found')
        return me

    def snapshot(self, uow: UnitOfWork, group_id: UUID, user_id: UUID) -> dict:
        group = uow.groups.group(group_id)
        members = uow.groups.members(group_id)
        rows = uow.groups.expenses(group_id)
        expenses = [self.expense_payload(row) for row in rows if row.deleted_at is None]
        deleted = [self.expense_payload(row) for row in rows if row.deleted_at is not None]
        settlements = [self.settlement_payload(row) for row in uow.groups.settlements(group_id)]
        member_ids = [str(member.id) for member in members]
        by_user = {m.user_id: m.id for m in members if m.user_id is not None}
        return {
            'id': str(group.id), 'name': group.name, 'currencyCode': group.currency_code,
            'ownerID': str(by_user[group.owner_id]), 'meMemberID': str(by_user[user_id]), 'version': group.version,
            'members': [self.member_payload(m) for m in members],
            'expenses': expenses, 'deletedExpenses': deleted, 'settlements': settlements,
            'balances': balances(member_ids, expenses, settlements),
        }

    def group(self, group_id: str, user_id: str) -> dict:
        gid, uid = UUID(group_id), UUID(user_id)
        with self.uow() as uow:
            self.require_member(uow, gid, uid)
            return self.snapshot(uow, gid, uid)

    def groups(self, user_id: str) -> list[dict]:
        uid = UUID(user_id)
        with self.uow() as uow:
            return [self.snapshot(uow, gid, uid) for gid in uow.groups.group_ids_for_user(uid)]

    # --- groups, invitations ------------------------------------------------
    def create_group(self, user_id: str, input: GroupInput) -> tuple[dict, bool]:
        """
        Create a group; returns (snapshot, created). With a client `id` the call is repeatable: the same
        request again returns the existing group (created=False); the same id with a different body, or
        an id that is someone else's, is a conflict.
        """
        name = input.name.strip()
        if not name:
            fail(422, 'Group name is required')
        group_id = input.id or uuid4()
        uid = UUID(user_id)
        now = datetime.now(timezone.utc)
        with self.uow() as uow:
            if not uow.groups.insert_group(group_id, name, input.currency_code, uid, now):
                return self.replay_group(uow, group_id, uid, name, input), False
            if input.members is None:
                people = [(uuid4(), uid, uow.users.user_by_id(uid).name)]
            else:
                people = [(m.id, uid if m.id == input.me_member_id else None, m.name.strip()) for m in input.members]
            for member_id, member_user, member_name in people:
                if not uow.groups.insert_member(member_id, group_id, member_user, member_name, now):
                    fail(409, 'Member ID already in use', 'id_conflict')
            return self.snapshot(uow, group_id, uid), True

    def replay_group(self, uow: UnitOfWork, group_id: UUID, uid: UUID, name: str, input: GroupInput) -> dict:
        group = uow.groups.group(group_id)
        me = uow.groups.member_of(group_id, uid)
        if me is None or group.name != name or group.currency_code != input.currency_code:
            fail(409, 'Group ID already in use', 'id_conflict')
        if input.members is not None:
            existing = {m.id: m.name for m in uow.groups.members(group_id)}
            if me.id != input.me_member_id or any(existing.get(m.id) != m.name.strip() for m in input.members):
                fail(409, 'Group ID already in use', 'id_conflict')
        return self.snapshot(uow, group_id, uid)

    def rename_group(self, group_id: str, user_id: str, name: str) -> dict:
        if not name.strip():
            fail(422, 'Group name is required')
        gid = UUID(group_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            uow.groups.rename_group(gid, name.strip())
            return self.snapshot(uow, gid, UUID(user_id))

    def put_member(self, group_id: str, member_id: str, user_id: str, name: str) -> dict:
        """
        Add a person to the group or rename one (the client chooses the id, so repeating a request is safe).
        A new person has no account until an invitation links one. Names need not be unique; last write wins.
        """
        name = name.strip()
        if not name:
            fail(422, 'Name is required')
        gid, mid = UUID(group_id), UUID(member_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            existing = uow.groups.member(mid, lock=True)
            if existing is None:
                uow.groups.insert_member(mid, gid, None, name, datetime.now(timezone.utc))
                uow.groups.bump_version(gid)
            elif existing.group_id != gid:
                fail(409, 'Member ID belongs to another group', 'id_conflict')
            elif existing.name != name:
                uow.groups.rename_member(mid, name)
                uow.groups.bump_version(gid)
            return self.member_payload(uow.groups.member(mid))

    @staticmethod
    def member_payload(row: Row) -> dict:
        return {'id': str(row.id), 'name': row.name, 'userID': str(row.user_id) if row.user_id else None,
                'email': row.email}

    def invite(self, group_id: str, user_id: str, email: str, member_id: UUID | None = None) -> dict:
        email = normalize_email(email)
        gid = UUID(group_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            if uow.groups.is_member_email(gid, email):
                fail(409, 'Already a member')
            if member_id is not None:
                person = uow.groups.member(member_id)
                if person is None or person.group_id != gid:
                    fail(422, 'That person is not in this group')
                if person.user_id is not None:
                    fail(422, 'That person already has an account')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + INVITE_LIFETIME
            uow.groups.insert_invitation(hash_token(token), gid, email, expires, member_id)
        return {'inviteToken': token, 'expiresAt': expires.isoformat(), 'email': email, 'groupID': group_id,
                'memberID': str(member_id) if member_id else None}

    def accept_invite(self, user_id: str, token: str) -> dict:
        uid = UUID(user_id)
        with self.uow() as uow:
            token_hash = hash_token(token)
            row = uow.groups.invitation(token_hash)
            email = uow.users.user_by_id(uid).email
            now = datetime.now(timezone.utc)
            if row is None or row.expires_at <= now or row.accepted_at is not None:
                fail(404, 'Invitation missing or expired')
            if not hmac.compare_digest(row.email, email):
                fail(403, 'Invitation belongs to a different email')
            if uow.groups.member_of(row.group_id, uid) is not None:
                fail(409, 'Already a member')
            if row.member_id is not None:
                person = uow.groups.member(row.member_id, lock=True)
                if person.user_id is not None:
                    fail(409, 'That person was already linked to an account', 'id_conflict')
                uow.groups.link_member(person.id, uid)  # past expenses become this account's
            else:
                uow.groups.insert_member(uuid4(), row.group_id, uid, uow.users.user_by_id(uid).name, now)
            uow.groups.accept_invitation(token_hash, now)
            uow.groups.bump_version(row.group_id)
            return self.snapshot(uow, row.group_id, uid)

    # --- payloads -----------------------------------------------------------
    @staticmethod
    def expense_payload(row: Row) -> dict:
        return {'id': str(row.id), 'groupID': str(row.group_id), 'merchant': row.merchant,
                'occurredAt': format_utc(row.occurred_at), 'category': row.category, 'notes': row.notes,
                'amountMinor': row.amount_minor, 'payerID': str(row.payer_id), 'method': row.method,
                'allocations': row.allocations, 'values': row.input_values, 'version': row.version,
                'hasReceipt': row.has_receipt, 'updatedAt': format_utc(row.updated_at),
                'deletedAt': format_utc(row.deleted_at) if row.deleted_at else None}

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
        with self.uow() as uow:
            self.require_member(uow, gid, uid)
            members = uow.groups.member_ids(gid)
            if input.payer_id not in members or not set(input.participants).issubset(members):
                fail(422, 'Payer and participants must belong to the group')
            existing = uow.groups.expense(input.id, lock=True)
            values = {
                'id': input.id, 'group_id': gid, 'merchant': input.merchant.strip(), 'occurred_at': occurred_at,
                'category': input.category, 'notes': input.notes, 'amount_minor': input.amount_minor,
                'payer_id': input.payer_id, 'method': input.method, 'allocations': allocations,
                'input_values': input.values, 'updated_at': datetime.now(timezone.utc),
            }
            if existing:
                if existing.group_id != gid:
                    fail(409, 'Expense ID belongs to another group', 'id_conflict')
                if existing.deleted_at is not None:
                    # Deleted: only an explicit restore (based on the tombstone's own version) goes through.
                    if input.version != existing.version:
                        fail(409, 'Expense was deleted', 'version_conflict', current=self.expense_payload(existing))
                    uow.groups.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
                elif self.same_content(existing, values):
                    # A retry after a lost response (or an identical edit): the write is already there.
                    return self.expense_payload(existing)
                else:
                    if input.version != existing.version:
                        fail(409, 'Expense changed; reload before saving', 'version_conflict',
                             current=self.expense_payload(existing))
                    uow.groups.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
            else:
                if input.version is not None:
                    fail(409, 'Expense missing; reload before saving', 'not_found')
                uow.groups.insert_expense({**values, 'version': 1})
            uow.groups.bump_version(gid)
            return self.expense_payload(uow.groups.expense(input.id))

    @staticmethod
    def same_content(row: Row, values: dict) -> bool:
        return (row.merchant == values['merchant'] and row.occurred_at == values['occurred_at']
                and row.category == values['category'] and row.notes == values['notes']
                and row.amount_minor == values['amount_minor'] and row.payer_id == values['payer_id']
                and row.method == values['method'] and row.allocations == values['allocations']
                and row.input_values == values['input_values'])

    def delete_expense(self, group_id: str, expense_id: str, user_id: str) -> None:
        """
        Delete wins: it succeeds whatever version the caller last saw, and repeating it is a no-op.
        The row stays as a tombstone so other devices learn about the delete (and can restore it).
        """
        gid = UUID(group_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            existing = uow.groups.expense(UUID(expense_id), lock=True)
            if existing is None or existing.deleted_at is not None:
                return  # nothing to delete: the end state is what the caller wanted
            if existing.group_id != gid:
                fail(404, 'Expense not found')
            uow.groups.tombstone_expense(existing.id, datetime.now(timezone.utc))
            uow.groups.bump_version(gid)

    # --- settlements --------------------------------------------------------
    def settle(self, group_id: str, user_id: str, input: SettlementInput) -> tuple[dict, bool]:
        """
        Record a payment. Returns (settlement, created). It is validated against the balances at the
        moment it is applied, never against a group version, and repeating the same request (same id,
        same payload) returns the stored settlement instead of an error, so a retry cannot fail or duplicate.
        """
        gid, uid = UUID(group_id), UUID(user_id)
        with self.uow() as uow:
            me = self.require_member(uow, gid, uid)
            # Serialize writers on this group so two payments cannot both pass the balance check.
            uow.groups.group(gid, lock=True)
            from_id, to_id = str(input.from_id), str(input.to_id)
            if me.id not in (input.from_id, input.to_id):
                fail(403, 'Only a settlement participant may record it')
            existing = uow.groups.settlement(input.id)
            if existing is not None:
                same = (existing.group_id == gid and existing.from_id == input.from_id
                        and existing.to_id == input.to_id and existing.amount_minor == input.amount_minor)
                if not same:
                    fail(409, 'Settlement ID already used for a different payment', 'id_conflict')
                return self.settlement_payload(existing), False
            group = self.snapshot(uow, gid, uid)
            balance = {item['memberID']: item['minorUnits'] for item in group['balances']}
            if from_id == to_id or from_id not in balance or to_id not in balance:
                fail(422, 'Settlement members must be different group members')
            owed = max(0, min(-balance[from_id], balance[to_id]))
            if input.amount_minor > owed:
                fail(422, 'Nothing is owed between these members' if owed == 0
                     else 'Settlement exceeds outstanding balance', 'exceeds_balance', maxAmountMinor=owed)
            uow.groups.insert_settlement(input.id, gid, input.from_id, input.to_id, input.amount_minor,
                                              datetime.now(timezone.utc))
            uow.groups.bump_version(gid)
            return self.settlement_payload(uow.groups.settlement(input.id)), True

    # --- receipts -----------------------------------------------------------
    def put_receipt(self, group_id: str, expense_id: str, user_id: str, data: bytes, mime: str) -> dict:
        if mime not in ('image/jpeg', 'image/png') or not data or len(data) > MAX_RECEIPT_BYTES:
            fail(422, 'Receipt must be a JPEG or PNG under 5 MB')
        if (mime == 'image/jpeg' and not data.startswith(b'\xff\xd8\xff')) or \
           (mime == 'image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n')):
            fail(422, 'Receipt content does not match its type')
        gid = UUID(group_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
        data = self.normalized_jpeg(data, mime)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            if not uow.groups.set_receipt(gid, UUID(expense_id), data, 'image/jpeg'):
                fail(404, 'Expense not found')
            uow.groups.bump_version(gid)
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
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            row = uow.groups.receipt(gid, UUID(expense_id))
        if row is None or row.receipt is None:
            fail(404, 'Receipt not found')
        return bytes(row.receipt), row.receipt_type

    def delete_receipt(self, group_id: str, expense_id: str, user_id: str) -> None:
        gid = UUID(group_id)
        with self.uow() as uow:
            self.require_member(uow, gid, UUID(user_id))
            if not uow.groups.set_receipt(gid, UUID(expense_id), None, None):
                fail(404, 'Expense not found')
            uow.groups.bump_version(gid)
