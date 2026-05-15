from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_credential_service, get_new_relic_client, get_profile_id
from app.errors import AppError
from app.schemas.entities import EntityDetailResponse, EntityListResponse
from app.services.entity_service import normalize_entity
from app.services.newrelic_client import NewRelicClient, NewRelicClientError

router = APIRouter(prefix="/api/entities", tags=["entities"])


@router.get("/apm", response_model=EntityListResponse)
async def list_apms(profile_id: str | None = Depends(get_profile_id), account_id: int | None = Query(default=None)) -> EntityListResponse:
    client: NewRelicClient = get_new_relic_client(profile_id)
    record = get_credential_service().get(profile_id)
    account_ids = [account_id] if account_id else record.account_ids if record else None
    try:
        data = await client.list_apm_entities(account_ids=account_ids)
        return EntityListResponse(entities=[normalize_entity(entity) for entity in data.get("entities", [])], next_cursor=data.get("nextCursor"))
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc


@router.get("/search", response_model=EntityListResponse)
async def search_entities(q: str = Query(min_length=1), profile_id: str | None = Depends(get_profile_id)) -> EntityListResponse:
    client: NewRelicClient = get_new_relic_client(profile_id)
    safe_q = q.replace("'", "")[:120]
    try:
        data = await client.entity_search(f"name LIKE '{safe_q}'")
        return EntityListResponse(entities=[normalize_entity(entity) for entity in data.get("entities", [])], next_cursor=data.get("nextCursor"))
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc


@router.get("/{guid}", response_model=EntityDetailResponse)
async def get_entity(guid: str, profile_id: str | None = Depends(get_profile_id)) -> EntityDetailResponse:
    client: NewRelicClient = get_new_relic_client(profile_id)
    try:
        entity = await client.get_entity(guid)
        if not entity:
            raise AppError("ENTITY_NOT_FOUND", "No encontré esa entidad en New Relic.", 404)
        account_id = entity.get("accountId")
        if account_id:
            metadata = await client.detect_apm_data_sources(int(account_id), guid)
            entity["transactionEventType"] = metadata.get("primary_event_type")
            entity["transactionNameAttribute"] = metadata.get("transaction_name_attribute")
            entity["dataSources"] = metadata.get("data_sources", [])
            entity["timeBasis"] = metadata.get("time_basis", "UTC")
        return EntityDetailResponse(entity=normalize_entity(entity))
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc
