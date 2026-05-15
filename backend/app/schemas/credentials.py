from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, SecretStr, field_validator


class CredentialValidateRequest(BaseModel):
    api_key: SecretStr = Field(min_length=8)
    account_id: int | None = Field(default=None, gt=0)
    account_ids: list[int] = Field(default_factory=list)
    region: Literal["US", "EU"] = "US"

    @field_validator("account_ids")
    @classmethod
    def validate_account_ids(cls, value: list[int]) -> list[int]:
        unique: list[int] = []
        for item in value:
            if item <= 0:
                raise ValueError("Account IDs must be positive integers")
            if item not in unique:
                unique.append(item)
        return unique

    @property
    def all_account_ids(self) -> list[int]:
        ids = list(self.account_ids)
        if self.account_id and self.account_id not in ids:
            ids.insert(0, self.account_id)
        return ids


class CredentialSaveRequest(CredentialValidateRequest):
    label: str = Field(default="Default workspace", min_length=1, max_length=80)
    persist: bool = True


class AccountSummary(BaseModel):
    id: int
    name: str | None = None


class CredentialProfileResponse(BaseModel):
    ok: bool = True
    profile_id: str
    label: str
    region: Literal["US", "EU"]
    account_ids: list[int]
    masked_api_key: str
    persisted: bool
    accounts: list[AccountSummary] = []
    message: str
