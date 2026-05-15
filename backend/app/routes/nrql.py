from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.dependencies import get_new_relic_client, get_profile_id
from app.errors import AppError
from app.schemas.nrql import NrqlRunRequest, NrqlRunResponse
from app.services.newrelic_client import NewRelicClient, NewRelicClientError
from app.services.visualization_engine import VisualizationEngine

router = APIRouter(prefix="/api/nrql", tags=["nrql"])


@router.post("/run", response_model=NrqlRunResponse)
async def run_nrql(payload: NrqlRunRequest, profile_id: str | None = Depends(get_profile_id)) -> NrqlRunResponse:
    client: NewRelicClient = get_new_relic_client(profile_id)
    try:
        result = await client.run_nrql(payload.account_id, payload.nrql, timeout_seconds=get_settings().nrql_timeout_seconds)
    except NewRelicClientError as exc:
        raise AppError(exc.code, exc.message, exc.status_code, exc.details) from exc
    rows = result.get("results", []) or []
    charts = VisualizationEngine().build_visualizations(
        rows,
        nrql=payload.nrql,
        account_id=payload.account_id,
        entity_guid=payload.entity_guid,
        title="NRQL result",
        time_range=payload.time_range.model_dump() if payload.time_range else None,
    )
    return NrqlRunResponse(account_id=payload.account_id, entity_guid=payload.entity_guid, nrql=payload.nrql, rows=rows, metadata=result.get("metadata", {}), visualizations=charts)
