from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import get_new_relic_tools, get_profile_id

router = APIRouter(prefix="/api/investigations", tags=["investigations"])


class InvestigationCreateRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    nrql: str
    entity_guid: str | None = None


@router.post("")
async def create_investigation(payload: InvestigationCreateRequest, profile_id: str | None = Depends(get_profile_id)) -> dict:
    tools = get_new_relic_tools(profile_id)
    summary = tools.create_investigation_summary(payload.rows, payload.nrql)
    return {"ok": True, "investigation": summary}


@router.get("/{investigation_id}")
async def get_investigation(investigation_id: str) -> dict:
    return {"ok": True, "id": investigation_id, "message": "Investigation persistence is enabled in the database layer; create one from chat or charts to populate it."}
