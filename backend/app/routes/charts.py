from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.visualization_engine import VisualizationEngine

router = APIRouter(prefix="/api/charts", tags=["charts"])


class BuildChartRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    nrql: str | None = None
    account_id: int | None = None
    entity_guid: str | None = None
    title: str = "Gráfica generada"
    chart_type: str | None = None


@router.post("/build")
async def build_chart(payload: BuildChartRequest) -> dict:
    charts = VisualizationEngine().build_visualizations(payload.rows, nrql=payload.nrql, account_id=payload.account_id, entity_guid=payload.entity_guid, title=payload.title, chart_type=payload.chart_type)
    return {"ok": True, "visualizations": charts}
