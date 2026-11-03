"""Rows as the repositories return them (SQLAlchemy `Row`s), built by hand for service tests."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


def member_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{'id': uuid4(), 'group_id': uuid4(), 'user_id': uuid4(), 'name': 'Ada', 'email': None, **changes})


def user_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{'id': uuid4(), 'name': 'Ada', 'email': 'ada@example.com', **changes})


def expense_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{
        'id': uuid4(), 'group_id': uuid4(), 'merchant': 'Dinner', 'occurred_at': NOW, 'category': 'other',
        'notes': '', 'amount_minor': 1001, 'payer_id': uuid4(), 'method': 'equal', 'allocations': [],
        'input_values': [], 'version': 1, 'has_receipt': False, 'updated_at': NOW, 'deleted_at': None, **changes})


def settlement_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{
        'id': uuid4(), 'group_id': uuid4(), 'from_id': uuid4(), 'to_id': uuid4(), 'amount_minor': 100,
        'created_at': NOW, **changes})


def invitation_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{
        'token_hash': 'h', 'group_id': uuid4(), 'email': 'cy@example.com', 'expires_at': datetime(2999, 1, 1, tzinfo=timezone.utc),
        'accepted_at': None, 'member_id': None, **changes})



def group_row(**changes) -> SimpleNamespace:
    return SimpleNamespace(**{'id': uuid4(), 'name': 'Trip', 'currency_code': 'USD', 'owner_id': uuid4(), 'version': 1,
                              **changes})
