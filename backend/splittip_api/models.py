from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class Person(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=80)


class Item(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(ge=0, le=1_000_000_000, max_digits=13, decimal_places=3)
    assigned_person_ids: list[UUID] = Field(alias="assignedPersonIDs", min_length=1)


class Bill(BaseModel):
    people: list[Person] = Field(min_length=1, max_length=20)
    items: list[Item] = Field(min_length=1, max_length=100)
    tax: Decimal = Field(ge=0, le=1_000_000_000, max_digits=13, decimal_places=3)
    tip_percentage: Decimal = Field(alias="tipPercentage", ge=0, le=100, max_digits=5)
    receipt_total: Decimal | None = Field(
        default=None, alias="receiptTotal", ge=0, le=1_000_000_000, max_digits=13, decimal_places=3
    )

    @model_validator(mode="after")
    def validate_assignments(self) -> Bill:
        person_ids = {person.id for person in self.people}
        if len(person_ids) != len(self.people):
            raise ValueError("person IDs must be unique")
        if len({item.id for item in self.items}) != len(self.items):
            raise ValueError("item IDs must be unique")
        for item in self.items:
            if not set(item.assigned_person_ids).issubset(person_ids):
                raise ValueError("items may only be assigned to known people")
        return self


class CreateSession(BaseModel):
    bill: Bill


class UpdateSession(BaseModel):
    version: int = Field(ge=1)
    bill: Bill


class Session(BaseModel):
    id: UUID
    version: int
    expires_at: str = Field(alias="expiresAt")
    bill: Bill


class CreatedSession(Session):
    access_token: str = Field(alias="accessToken")


class ProductEvent(BaseModel):
    name: Literal["calculator_opened", "scan_opened", "scan_completed", "itemized_opened", "share_created"]
    variant: Literal["A", "B"]
