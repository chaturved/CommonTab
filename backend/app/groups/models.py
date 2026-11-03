from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator, constr


class NewMember(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=80)


class GroupInput(BaseModel):
    # A client-chosen id makes creating a group repeatable: the same request again returns the same group.
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    currency_code: Literal["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"] = Field(alias="currencyCode")
    # Optional people to start with (used when uploading a group that already exists on a phone).
    # `meMemberID` says which of them is the signed-in account. Without `members`, the creator is the only member.
    members: list[NewMember] | None = Field(default=None, min_length=1, max_length=50)
    me_member_id: UUID | None = Field(default=None, alias="meMemberID")

    @model_validator(mode="after")
    def validate_members(self) -> GroupInput:
        if self.members is None:
            if self.me_member_id is not None:
                raise ValueError("meMemberID needs members")
            return self
        ids = [member.id for member in self.members]
        if len(set(ids)) != len(ids):
            raise ValueError("Member ids must be unique")
        if self.me_member_id not in ids:
            raise ValueError("meMemberID must be one of the members")
        if any(not member.name.strip() for member in self.members):
            raise ValueError("Member names are required")
        return self


class InvitationInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    # An existing person without an account: accepting the invitation links them to the account.
    member_id: UUID | None = Field(default=None, alias="memberID")


class ExpenseInput(BaseModel):
    id: UUID
    merchant: str = Field(min_length=1, max_length=120)
    occurred_at: str = Field(alias="occurredAt")
    category: str = Field(default="other", max_length=40)
    notes: str = Field(default="", max_length=2000)
    amount_minor: int = Field(gt=0, le=100_000_000_000, alias="amountMinor")
    payer_id: UUID = Field(alias="payerID")
    method: Literal["equal", "exact", "percentage"]
    participants: list[UUID] = Field(min_length=1, max_length=20)
    values: list[constr(max_length=32)] = Field(default_factory=list)
    version: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_participants(self) -> ExpenseInput:
        if len(set(self.participants)) != len(self.participants):
            raise ValueError("Participants must be unique")
        if self.method != "equal" and len(self.values) != len(self.participants):
            raise ValueError("One value is required per participant")
        if self.method == "equal" and self.values:
            raise ValueError("Equal splits cannot include values")
        return self


class SettlementInput(BaseModel):
    id: UUID
    # Accepted and ignored: settlements are checked against balances when applied, so a payment queued
    # offline does not go stale when the group changes.
    group_version: int | None = Field(default=None, ge=1, alias="groupVersion")
    from_id: UUID = Field(alias="fromID")
    to_id: UUID = Field(alias="toID")
    amount_minor: int = Field(gt=0, le=100_000_000_000, alias="amountMinor")


class MemberInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class RenameGroupInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)




class AcceptInvitation(BaseModel):
    inviteToken: str
