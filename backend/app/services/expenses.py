from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Row

from fastapi import Depends

from app.core.errors import fail
from app.domain.rules import allocation, parse_utc
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
                 guard: MembershipGuard = Depends(MembershipGuard)):
        self.expenses = expenses
        self.members = members
        self.groups = groups
        self.guard = guard

    def save_expense(self, group_id: str, user_id: str, input: ExpenseInput) -> dict:
        occurred_at = parse_utc(input.occurred_at)
        if not input.merchant.strip():
            fail(422, 'Expense description is required')
        gid, uid = UUID(group_id), UUID(user_id)
        participants = [str(member) for member in input.participants]
        allocations = allocation(input.amount_minor, input.method, participants, input.values)
        self.guard.require(gid, uid)
        members = self.members.member_ids(gid)
        if input.payer_id not in members or not set(input.participants).issubset(members):
            fail(422, 'Payer and participants must belong to the group')
        existing = self.expenses.expense(input.id, lock=True)
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
                    fail(409, 'Expense was deleted', 'version_conflict', current=expense_payload(existing))
                self.expenses.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
            elif self.same_content(existing, values):
                # A retry after a lost response (or an identical edit): the write is already there.
                return expense_payload(existing)
            else:
                if input.version != existing.version:
                    fail(409, 'Expense changed; reload before saving', 'version_conflict',
                         current=expense_payload(existing))
                self.expenses.update_expense({**values, 'version': existing.version + 1, 'deleted_at': None})
        else:
            if input.version is not None:
                fail(409, 'Expense missing; reload before saving', 'not_found')
            self.expenses.insert_expense({**values, 'version': 1})
        self.groups.bump_version(gid)
        return expense_payload(self.expenses.expense(input.id))

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
        self.guard.require(gid, UUID(user_id))
        existing = self.expenses.expense(UUID(expense_id), lock=True)
        if existing is None or existing.deleted_at is not None:
            return  # nothing to delete: the end state is what the caller wanted
        if existing.group_id != gid:
            fail(404, 'Expense not found')
        self.expenses.tombstone_expense(existing.id, datetime.now(timezone.utc))
        self.groups.bump_version(gid)
