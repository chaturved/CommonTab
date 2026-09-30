from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_FLOOR

from ..errors import fail


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
