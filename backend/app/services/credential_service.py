from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, ClassVar

from app.db.session import Database
from app.security import CredentialCipher, mask_secret


@dataclass(slots=True)
class CredentialRecord:
    profile_id: str
    label: str
    account_ids: list[int]
    region: str
    api_key: str
    persisted: bool


class CredentialService:
    _ephemeral: ClassVar[dict[str, CredentialRecord]] = {}

    def __init__(self, db: Database, cipher: CredentialCipher, env_api_key: str | None = None, env_account_id: int | None = None, env_region: str = "US") -> None:
        self.db = db
        self.cipher = cipher
        self.env_api_key = env_api_key
        self.env_account_id = env_account_id
        self.env_region = env_region

    def save(self, label: str, account_ids: list[int], region: str, api_key: str, persist: bool = True) -> CredentialRecord:
        if persist:
            encrypted = self.cipher.encrypt(api_key)
            profile_id = self.db.insert_credential(label=label, account_ids=account_ids, region=region, encrypted_api_key=encrypted)
            return CredentialRecord(profile_id, label, account_ids, region, api_key, True)
        profile_id = f"session_{uuid.uuid4()}"
        record = CredentialRecord(profile_id, label, account_ids, region, api_key, False)
        self._ephemeral[profile_id] = record
        return record

    def get(self, profile_id: str | None = None) -> CredentialRecord | None:
        if profile_id:
            if profile_id in self._ephemeral:
                return self._ephemeral[profile_id]
            data = self.db.get_credential(profile_id)
            if data:
                return CredentialRecord(
                    profile_id=str(data["id"]),
                    label=str(data["label"]),
                    account_ids=[int(item) for item in data["account_ids"]],
                    region=str(data["region"]),
                    api_key=self.cipher.decrypt(str(data["encrypted_api_key"])),
                    persisted=True,
                )
        if self.env_api_key:
            account_ids = [self.env_account_id] if self.env_account_id else []
            return CredentialRecord("env", "Environment", account_ids, self.env_region, self.env_api_key, False)
        return None

    def delete(self, profile_id: str) -> bool:
        if profile_id in self._ephemeral:
            del self._ephemeral[profile_id]
            return True
        return self.db.delete_credential(profile_id)

    @staticmethod
    def safe_profile(record: CredentialRecord, accounts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return {
            "ok": True,
            "profile_id": record.profile_id,
            "label": record.label,
            "region": record.region,
            "account_ids": record.account_ids,
            "masked_api_key": mask_secret(record.api_key) or "",
            "persisted": record.persisted,
            "accounts": accounts or [],
            "message": "Conexión validada. La API key queda cifrada en backend y no se devuelve al frontend.",
        }
