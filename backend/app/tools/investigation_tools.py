from __future__ import annotations

from typing import Any


class InvestigationTools:
    def create_investigation_summary(self, rows: list[dict[str, Any]], nrql: str) -> dict[str, Any]:
        numeric = {}
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    numeric.setdefault(key, []).append(float(value))
        findings = [
            {"metric": key, "min": min(values), "max": max(values), "avg": sum(values) / len(values)}
            for key, values in numeric.items()
            if values
        ]
        return {"title": "Resumen ejecutivo", "summary": "Hallazgos calculados sobre rows reales de New Relic.", "findings": findings, "nrql": nrql}
