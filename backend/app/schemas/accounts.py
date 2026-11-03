from __future__ import annotations

from pydantic import BaseModel, Field


class AccountInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=15, max_length=128)


class LoginInput(BaseModel):
    email: str
    password: str


class UpdateProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class PasswordResetConfirm(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    code: str = Field(min_length=1, max_length=32)
    new_password: str = Field(min_length=15, max_length=128, alias='newPassword')


class ChangePasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=128, alias='currentPassword')
    new_password: str = Field(min_length=15, max_length=128, alias='newPassword')


class DeleteAccountInput(BaseModel):
    password: str = Field(min_length=1, max_length=128)
