from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_new_relic_client, get_profile_id
from app.errors import AppError
from app.services.newrelic_client import NewRelicClient, NewRelicClientError

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
async def list_accounts(profile_id: str | None = Depends(get_profile_id)) -> dict:
    client: NewRelicClient = get_new_relic_client(profile_id)
    try:
        return {"ok": True, "accounts": await client.list_accounts()}
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc
