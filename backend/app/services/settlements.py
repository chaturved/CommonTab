from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from app.core.errors import fail
from app.repositories.unit_of_work import UnitOfWorkFactory
from app.schemas.groups import SettlementInput
from app.services.access import require_member
from app.services.snapshots import SnapshotBuilder, settlement_payload


class SettlementService:
    def __init__(self, uow: UnitOfWorkFactory, snapshots: SnapshotBuilder):
        self.uow = uow
        self.snapshots = snapshots

    def settle(self, group_id: str, user_id: str, input: SettlementInput) -> tuple[dict, bool]:
        """
        Record a payment. Returns (settlement, created). It is validated against the balances at the
        moment it is applied, never against a group version, and repeating the same request (same id,
        same payload) returns the stored settlement instead of an error, so a retry cannot fail or duplicate.
        """
        gid, uid = UUID(group_id), UUID(user_id)
        with self.uow() as uow:
            me = require_member(uow, gid, uid)
            # Serialize writers on this group so two payments cannot both pass the balance check.
            uow.groups.group(gid, lock=True)
            from_id, to_id = str(input.from_id), str(input.to_id)
            if me.id not in (input.from_id, input.to_id):
                fail(403, 'Only a settlement participant may record it')
            existing = uow.settlements.settlement(input.id)
            if existing is not None:
                same = (existing.group_id == gid and existing.from_id == input.from_id
                        and existing.to_id == input.to_id and existing.amount_minor == input.amount_minor)
                if not same:
                    fail(409, 'Settlement ID already used for a different payment', 'id_conflict')
                return settlement_payload(existing), False
            group = self.snapshots.build(uow, gid, uid)
            balance = {item['memberID']: item['minorUnits'] for item in group['balances']}
            if from_id == to_id or from_id not in balance or to_id not in balance:
                fail(422, 'Settlement members must be different group members')
            owed = max(0, min(-balance[from_id], balance[to_id]))
            if input.amount_minor > owed:
                fail(422, 'Nothing is owed between these members' if owed == 0
                     else 'Settlement exceeds outstanding balance', 'exceeds_balance', maxAmountMinor=owed)
            uow.settlements.insert_settlement(input.id, gid, input.from_id, input.to_id, input.amount_minor,
                                              datetime.now(timezone.utc))
            uow.groups.bump_version(gid)
            return settlement_payload(uow.settlements.settlement(input.id)), True
