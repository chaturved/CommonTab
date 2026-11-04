from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Row

from fastapi import Depends

from app.core.errors import fail
from app.domain.currency import convert_minor
from app.domain.rules import allocation, parse_utc
from app.repositories.activity import ActivityRepository
from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.schemas.groups import ExpenseInput
from app.services.access import MembershipGuard
from app.services.snapshots import expense_payload


class ExpenseService:
    def __init__(self, expenses: ExpenseRepository = Depends(ExpenseRepository),
                 members: MemberRepository = Depends(MemberRepository),
                 groups: GroupRepository = Depends(GroupRepository),
                 guard: MembershipGuard = Depends(MembershipGuard),
                 activity: ActivityRepository = Depends(ActivityRepository)):
        self.expenses = expenses
        self.members = members
        self.groups = groups
        self.guard = guard
        self.activity = activity

    def save_expense(self, group_id: str, user_id: str, input: ExpenseInput) -> dict:
        occurred_at = parse_utc(input.occurred_at)
        if not input.merchant.strip():
            fail(422, 'Expense description is required')
        gid, uid = UUID(group_id), UUID(user_id)
        participants = [str(member) for member in input.participants]
        allocations = allocation(input.amount_minor, input.method, participants, input.values)
        me = self.guard.require(gid, uid)
        group = self.groups.group(gid)
        self.check_conversion(group.currency_code, input)
        if group.archived_at is not None:
            self.groups.unarchive(gid)
        members = self.members.member_ids(gid)
        if input.payer_id not in members or not set(input.participants).issubset(members):
            fail(422, 'Payer and participants must belong to the group')
        existing = self.expenses.expense(input.id, lock=True)
        values = {
            'id': input.id, 'group_id': gid, 'merchant': input.merchant.strip(), 'occurred_at': occurred_at,
            'category': input.category, 'notes': input.notes, 'amount_minor': input.amount_minor,
            'payer_id': input.payer_id, 'method': input.method, 'allocations': allocations,
            'input_values': input.values, 'updated_at': datetime.now(timezone.utc),
            'currency_code': input.currency_code, 'original_minor': input.original_minor, 'rate_micros': input.rate_micros,
        }
        if existing:
            if existing.group_id != gid:
                fail(409, 'Expense ID belongs to another group', 'id_conflict')
            if existing.deleted_at is not None:
                if input.version != existing.version:
                    fail(409, 'Expense was deleted', 'version_conflict', current=expense_payload(existing))
                self.expenses.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
                self.log(gid, me.id, 'expense.added', input.id, {'merchant': values['merchant'], 'amountMinor': input.amount_minor}, values['updated_at'])
            elif self.same_content(existing, values):
                return expense_payload(existing)
            else:
                if input.version != existing.version:
                    fail(409, 'Expense changed; reload before saving', 'version_conflict',
                         current=expense_payload(existing))
                self.expenses.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
                self.log(gid, me.id, 'expense.edited', input.id, {'merchant': values['merchant'], 'amountMinor': input.amount_minor,
                         'previousMerchant': existing.merchant, 'previousAmountMinor': existing.amount_minor}, values['updated_at'])
        else:
            if input.version is not None:
                fail(409, 'Expense missing; reload before saving', 'not_found')
            self.expenses.insert_expense({**values, 'version': 1})
            self.log(gid, me.id, 'expense.added', input.id, {'merchant': values['merchant'], 'amountMinor': input.amount_minor}, values['updated_at'])
        self.groups.bump_version(gid)
        return expense_payload(self.expenses.expense(input.id))

    @staticmethod
    def check_conversion(group_currency: str, input: ExpenseInput) -> None:
        if input.currency_code is None:
            return
        if input.currency_code == group_currency:
            fail(422, 'The expense is already in the group currency')
        try:
            expected = convert_minor(input.original_minor, input.currency_code, group_currency, input.rate_micros)
        except ValueError as problem:
            fail(422, str(problem))
        if input.amount_minor != expected:
            fail(422, 'The amount does not match the original amount and rate', 'conversion_mismatch', expectedAmountMinor=expected)

    def log(self, group_id: UUID, actor_id: UUID, kind: str, subject_id: UUID, data: dict, at: datetime) -> None:
        self.activity.record(group_id, actor_id, kind, subject_id, data, at)

    @staticmethod
    def same_content(row: Row, values: dict) -> bool:
        return (row.merchant == values['merchant'] and row.occurred_at == values['occurred_at']
                and row.category == values['category'] and row.notes == values['notes']
                and row.amount_minor == values['amount_minor'] and row.payer_id == values['payer_id']
                and row.method == values['method'] and row.allocations == values['allocations']
                and row.input_values == values['input_values'] and row.currency_code == values['currency_code']
                and row.original_minor == values['original_minor'] and row.rate_micros == values['rate_micros'])

    def delete_expense(self, group_id: str, expense_id: str, user_id: str) -> None:
        gid = UUID(group_id)
        me = self.guard.require(gid, UUID(user_id))
        existing = self.expenses.expense(UUID(expense_id), lock=True)
        if existing is None or existing.deleted_at is not None:
            return
        if existing.group_id != gid:
            fail(404, 'Expense not found')
        now = datetime.now(timezone.utc)
        self.expenses.tombstone_expense(existing.id, now)
        self.log(gid, me.id, 'expense.deleted', existing.id, {'merchant': existing.merchant, 'amountMinor': existing.amount_minor}, now)
        self.groups.bump_version(gid)
