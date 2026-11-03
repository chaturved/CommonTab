"""
In-memory stand-ins for the repositories, with the same method names and arguments as the real ones
(app/repositories). Rows are SimpleNamespace objects with the same columns. They keep services testable
without a database; the integration tests are what check that the real SQL behaves the same way.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4


def row(**columns) -> SimpleNamespace:
    return SimpleNamespace(**columns)


class FakeMembers:
    def __init__(self):
        self.rows: dict[UUID, SimpleNamespace] = {}

    def insert_member(self, member_id, group_id, user_id, name, created_at) -> bool:
        if member_id in self.rows:
            return False
        self.rows[member_id] = row(id=member_id, group_id=group_id, user_id=user_id, name=name, email=None)
        return True

    def member_of(self, group_id, user_id):
        return next((m for m in self.rows.values() if m.group_id == group_id and m.user_id == user_id), None)

    def members(self, group_id):
        return [m for m in self.rows.values() if m.group_id == group_id]

    def member_ids(self, group_id) -> set[UUID]:
        return {m.id for m in self.members(group_id)}

    def member(self, member_id, lock=False):
        return self.rows.get(member_id)

    def link_member(self, member_id, user_id) -> None:
        self.rows[member_id].user_id = user_id

    def rename_member(self, member_id, name) -> None:
        self.rows[member_id].name = name

    def is_member_email(self, group_id, email) -> bool:
        return any(m.email == email for m in self.members(group_id))


class FakeGroups:
    def __init__(self):
        self.rows: dict[UUID, SimpleNamespace] = {}

    def insert_group(self, group_id, name, currency, owner, created_at) -> bool:
        if group_id in self.rows:
            return False
        self.rows[group_id] = row(id=group_id, name=name, currency_code=currency, owner_id=owner, version=1)
        return True

    def group(self, group_id, lock=False):
        return self.rows[group_id]

    def group_ids_for_user(self, user_id):
        return list(self.rows)

    def rename_group(self, group_id, name) -> None:
        self.rows[group_id].name = name

    def bump_version(self, group_id) -> None:
        self.rows[group_id].version += 1


class FakeExpenses:
    def __init__(self):
        self.rows: dict[UUID, SimpleNamespace] = {}

    def expenses(self, group_id):
        return [e for e in self.rows.values() if e.group_id == group_id]

    def expense(self, expense_id, lock=False):
        return self.rows.get(expense_id)

    def insert_expense(self, values: dict) -> None:
        self.rows[values['id']] = row(**{**values, 'has_receipt': False, 'deleted_at': None})

    def update_expense(self, values: dict) -> None:
        self.rows[values['id']].__dict__.update(values)

    def tombstone_expense(self, expense_id, now) -> None:
        expense = self.rows[expense_id]
        expense.deleted_at = now
        expense.version += 1
        expense.updated_at = now


class FakeSettlements:
    def __init__(self):
        self.rows: dict[UUID, SimpleNamespace] = {}

    def settlements(self, group_id):
        return [s for s in self.rows.values() if s.group_id == group_id]

    def settlement(self, settlement_id):
        return self.rows.get(settlement_id)

    def insert_settlement(self, settlement_id, group_id, from_id, to_id, amount, created_at) -> bool:
        if settlement_id in self.rows:
            return False
        self.rows[settlement_id] = row(id=settlement_id, group_id=group_id, from_id=from_id, to_id=to_id,
                                       amount_minor=amount, created_at=created_at)
        return True


class FakeUsers:
    def __init__(self):
        self.rows: dict[UUID, SimpleNamespace] = {}

    def add(self, name: str, email: str) -> SimpleNamespace:
        user = row(id=uuid4(), name=name, email=email, password_hash='x')
        self.rows[user.id] = user
        return user

    def user_by_id(self, user_id):
        return self.rows.get(user_id)


class FakeInvitations:
    def __init__(self):
        self.rows: dict[str, SimpleNamespace] = {}

    def insert_invitation(self, token_hash, group_id, email, expires_at, member_id=None) -> None:
        self.rows[token_hash] = row(token_hash=token_hash, group_id=group_id, email=email, expires_at=expires_at,
                                    accepted_at=None, member_id=member_id)

    def invitation(self, token_hash):
        return self.rows.get(token_hash)

    def accept_invitation(self, token_hash, accepted_at) -> None:
        self.rows[token_hash].accepted_at = accepted_at


NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
