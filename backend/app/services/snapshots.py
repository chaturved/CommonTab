from __future__ import annotations

from uuid import UUID

from sqlalchemy import Row

from fastapi import Depends

from app.domain.rules import balances, format_utc
from app.repositories.expenses import ExpenseRepository
from app.repositories.groups import GroupRepository
from app.repositories.members import MemberRepository
from app.repositories.settlements import SettlementRepository


def member_payload(row: Row) -> dict:
    return {'id': str(row.id), 'name': row.name, 'userID': str(row.user_id) if row.user_id else None,
            'email': row.email}


def expense_payload(row: Row) -> dict:
    return {'id': str(row.id), 'groupID': str(row.group_id), 'merchant': row.merchant,
            'occurredAt': format_utc(row.occurred_at), 'category': row.category, 'notes': row.notes,
            'amountMinor': row.amount_minor, 'payerID': str(row.payer_id), 'method': row.method,
            'allocations': row.allocations, 'values': row.input_values, 'version': row.version,
            'hasReceipt': row.has_receipt, 'updatedAt': format_utc(row.updated_at),
            'deletedAt': format_utc(row.deleted_at) if row.deleted_at else None}


def settlement_payload(row: Row) -> dict:
    return {'id': str(row.id), 'groupID': str(row.group_id), 'fromID': str(row.from_id),
            'toID': str(row.to_id), 'amountMinor': row.amount_minor, 'createdAt': row.created_at.isoformat()}


class SnapshotBuilder:
    def __init__(self, groups: GroupRepository = Depends(GroupRepository),
                 members: MemberRepository = Depends(MemberRepository),
                 expenses: ExpenseRepository = Depends(ExpenseRepository),
                 settlements: SettlementRepository = Depends(SettlementRepository)):
        self.groups = groups
        self.members = members
        self.expenses = expenses
        self.settlements = settlements

    def build(self, group_id: UUID, user_id: UUID) -> dict:
        group = self.groups.group(group_id)
        members = self.members.members(group_id)
        rows = self.expenses.expenses(group_id)
        expenses = [expense_payload(row) for row in rows if row.deleted_at is None]
        deleted = [expense_payload(row) for row in rows if row.deleted_at is not None]
        settlements = [settlement_payload(row) for row in self.settlements.settlements(group_id)]
        member_ids = [str(member.id) for member in members]
        by_user = {m.user_id: m.id for m in members if m.user_id is not None}
        return {
            'id': str(group.id), 'name': group.name, 'currencyCode': group.currency_code,
            'ownerID': str(by_user[group.owner_id]), 'meMemberID': str(by_user[user_id]), 'version': group.version,
            'members': [member_payload(m) for m in members],
            'expenses': expenses, 'deletedExpenses': deleted, 'settlements': settlements,
            'balances': balances(member_ids, expenses, settlements),
        }
