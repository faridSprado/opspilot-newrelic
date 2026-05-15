from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from app.config import get_settings
from app.dependencies import get_credential_service
from app.errors import AppError
from app.schemas.credentials import CredentialProfileResponse, CredentialSaveRequest, CredentialValidateRequest
from app.services.credential_service import CredentialService
from app.services.newrelic_client import NewRelicClient, NewRelicClientError

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


async def _validate_with_new_relic(payload: CredentialValidateRequest) -> dict:
    settings = get_settings()
    client = NewRelicClient(payload.api_key.get_secret_value(), region=payload.region, timeout_seconds=settings.request_timeout_seconds)
    try:
        return await client.validate_credentials(payload.all_account_ids)
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc


@router.post("/validate", response_model=CredentialProfileResponse)
async def validate_credentials(payload: CredentialValidateRequest) -> dict:
    data = await _validate_with_new_relic(payload)
    accounts = data.get("accounts", [])
    requested = payload.all_account_ids or [int(account["id"]) for account in accounts[:1] if account.get("id")]
    api_key = payload.api_key.get_secret_value()
    record = get_credential_service().save("Validated session", requested, payload.region, api_key, persist=False)
    return CredentialService.safe_profile(record, accounts=accounts)


@router.post("/save", response_model=CredentialProfileResponse)
async def save_credentials(payload: CredentialSaveRequest, service: CredentialService = Depends(get_credential_service)) -> dict:
    data = await _validate_with_new_relic(payload)
    accounts = data.get("accounts", [])
    account_ids = payload.all_account_ids or [int(account["id"]) for account in accounts if account.get("id")]
    if not account_ids:
        raise AppError("NEW_RELIC_NO_ACCOUNTS", "La API Key es válida, pero no devolvió cuentas accesibles.", 400)
    record = service.save(payload.label, account_ids, payload.region, payload.api_key.get_secret_value(), persist=payload.persist)
    return CredentialService.safe_profile(record, accounts=accounts)


@router.get("/current", response_model=dict)
async def current_credentials(x_credential_profile_id: str | None = Header(default=None), service: CredentialService = Depends(get_credential_service)) -> dict:
    record = service.get(x_credential_profile_id)
    if not record:
        raise AppError("PROFILE_NOT_FOUND", "No hay una sesión de New Relic activa. Conecta tus credenciales para continuar.", 401)
    profile = CredentialService.safe_profile(record)
    profile.pop("message", None)
    return {"ok": True, "profile": profile}


@router.delete("", response_model=dict)
async def delete_credentials(x_credential_profile_id: str | None = Header(default=None), service: CredentialService = Depends(get_credential_service)) -> dict:
    if not x_credential_profile_id:
        raise AppError("PROFILE_ID_REQUIRED", "Envía X-Credential-Profile-Id para eliminar el perfil.", 400)
    deleted = service.delete(x_credential_profile_id)
    return {"ok": deleted}
