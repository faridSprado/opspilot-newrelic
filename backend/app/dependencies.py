from __future__ import annotations

from functools import lru_cache

from fastapi import Header

from app.config import get_settings
from app.db.session import Database
from app.errors import AppError
from app.security import CredentialCipher
from app.services.credential_service import CredentialService
from app.services.newrelic_client import NewRelicClient
from app.services.visualization_engine import VisualizationEngine
from app.tools.newrelic_tools import NewRelicTools


@lru_cache(maxsize=1)
def get_db() -> Database:
    return Database(get_settings().database_url)


@lru_cache(maxsize=1)
def get_cipher() -> CredentialCipher:
    return CredentialCipher(get_settings().app_secret_key)


def get_credential_service() -> CredentialService:
    settings = get_settings()
    return CredentialService(get_db(), get_cipher(), env_api_key=settings.new_relic_api_key, env_account_id=settings.new_relic_account_id, env_region=settings.new_relic_region)


def get_profile_id(x_credential_profile_id: str | None = Header(default=None)) -> str | None:
    return x_credential_profile_id


def get_new_relic_client(profile_id: str | None = None) -> NewRelicClient:
    settings = get_settings()
    record = get_credential_service().get(profile_id)
    if not record:
        raise AppError("CREDENTIALS_REQUIRED", "Conecta New Relic antes de consultar datos.", 401)
    return NewRelicClient(record.api_key, region=record.region, timeout_seconds=settings.request_timeout_seconds)


def get_new_relic_tools(profile_id: str | None = None) -> NewRelicTools:
    return NewRelicTools(get_new_relic_client(profile_id), VisualizationEngine())


def get_optional_new_relic_tools(profile_id: str | None = None) -> NewRelicTools | None:
    try:
        return get_new_relic_tools(profile_id)
    except AppError as exc:
        if exc.code == "CREDENTIALS_REQUIRED":
            return None
        raise
