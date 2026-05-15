from __future__ import annotations

from typing import Any

from app.schemas.common import ToolResponse
from app.services.visualization_engine import VisualizationEngine


class ChartTools:
    def __init__(self, engine: VisualizationEngine | None = None) -> None:
        self.engine = engine or VisualizationEngine()

    def generate_chart_spec(self, rows: list[dict[str, Any]], nrql: str | None = None, account_id: int | None = None, entity_guid: str | None = None) -> ToolResponse:
        charts = self.engine.build_visualizations(rows, nrql=nrql, account_id=account_id, entity_guid=entity_guid)
        return ToolResponse(ok=True, account_id=account_id, entity_guid=entity_guid, nrql=nrql, data={"rows": rows}, visualizations=charts)

    def explain_chart(self, rows: list[dict[str, Any]], chart: dict[str, Any]) -> str:
        if not rows:
            return "Sin datos reales para graficar. Se muestra empty state y la query ejecutada."
        labels = [field.get("label") for field in chart.get("y", [])]
        return f"Visualización segura con {len(rows)} filas y métricas: {', '.join(labels)}."
