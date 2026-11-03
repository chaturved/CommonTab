from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator, constr


class GroupInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency_code: Literal["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"] = Field(alias="currencyCode")


class InvitationInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)


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
    group_version: int = Field(ge=1, alias="groupVersion")
    from_id: UUID = Field(alias="fromID")
    to_id: UUID = Field(alias="toID")
    amount_minor: int = Field(gt=0, le=100_000_000_000, alias="amountMinor")


class RenameGroupInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)




class AcceptInvitation(BaseModel):
    inviteToken: str
