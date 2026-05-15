from __future__ import annotations

import math
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable

TIME_KEYS = {
    "begintimeseconds",
    "endtimeseconds",
    "timestamp",
    "timestampms",
    "time",
    "date",
    "datetime",
    "eventtime",
}
TIME_KEY_PRIORITY = ["beginTimeSeconds", "timestamp", "timestampMs", "endTimeSeconds", "time", "date", "datetime", "eventTime"]
ID_KEYS = {
    "id",
    "accountid",
    "entityid",
    "guid",
    "entityguid",
    "conditionid",
    "policyid",
    "incidentid",
    "issueid",
    "deploymentid",
}


def canonical_key(key: str) -> str:
    return key.replace("_", "").replace("-", "").replace(" ", "").lower()


def is_time_key(key: str) -> bool:
    return canonical_key(key) in TIME_KEYS


def is_id_key(key: str) -> bool:
    canonical = canonical_key(key)
    return canonical in ID_KEYS or canonical.endswith("id") or canonical.endswith("guid")


def is_numeric(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def detect_time_key(rows: list[dict[str, Any]]) -> str | None:
    if not rows:
        return None
    keys = list(rows[0].keys())
    for preferred in TIME_KEY_PRIORITY:
        for key in keys:
            if canonical_key(key) == canonical_key(preferred):
                return key
    for key in keys:
        if is_time_key(key):
            return key
    return None


def detect_x_key(rows: list[dict[str, Any]]) -> tuple[str | None, str]:
    time_key = detect_time_key(rows)
    if time_key:
        return time_key, "time"
    if not rows:
        return None, "category"
    for key, value in rows[0].items():
        if not is_id_key(key) and not is_numeric(value):
            return key, "category"
    first_key = next(iter(rows[0].keys()), None)
    return first_key, "category"


def detect_unit(key: str) -> str:
    lower = key.lower()
    if "apdex" in lower:
        return "apdex"
    if "%" in lower or "percent" in lower or "percentage" in lower or "error rate" in lower:
        return "percent"
    if any(token in lower for token in ["duration", "response", "latency", "time ms", "elapsed"]):
        return "ms"
    if any(token in lower for token in ["throughput", "rpm", "req/min", "request/min"]):
        return "rpm"
    if "rate" in lower:
        return "rate"
    if any(token in lower for token in ["byte", "memory", "heap"]):
        return "bytes"
    if any(token in lower for token in ["count", "total", "errors", "calls", "logs", "spans"]):
        return "count"
    return "custom"


def label_for_key(key: str) -> str:
    return key.replace("_", " ").strip()


def metric_keys(rows: list[dict[str, Any]], x_key: str | None = None) -> list[str]:
    if not rows:
        return []
    keys = list(rows[0].keys())
    metrics: list[str] = []
    for key in keys:
        if key == x_key or is_time_key(key) or is_id_key(key):
            continue
        values = [row.get(key) for row in rows]
        if any(is_numeric(value) for value in values):
            metrics.append(key)
    return metrics


def _floor_datetime_to_minute(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(second=0, microsecond=0)


def normalize_time_value(value: Any) -> Any:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if number > 10_000_000_000:
            return _floor_datetime_to_minute(datetime.fromtimestamp(number / 1000, tz=timezone.utc)).isoformat()
        if number > 1_000_000_000:
            return _floor_datetime_to_minute(datetime.fromtimestamp(number, tz=timezone.utc)).isoformat()
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return _floor_datetime_to_minute(parsed).isoformat()
        except ValueError:
            return value
    return value


def columns_for_rows(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not rows:
        return []
    seen: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.append(key)
    return [{"key": key, "label": label_for_key(key), "unit": "time" if is_time_key(key) else detect_unit(key)} for key in seen]


class VisualizationEngine:
    def build_visualizations(
        self,
        rows: list[dict[str, Any]],
        *,
        nrql: str | None = None,
        account_id: int | None = None,
        entity_guid: str | None = None,
        title: str = "New Relic data",
        chart_type: str | None = None,
        time_range: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if not rows:
            return [self._table_spec(rows, nrql=nrql, account_id=account_id, entity_guid=entity_guid, title="Sin datos para graficar", time_range=time_range)]

        x_key, x_type = detect_x_key(rows)
        metrics = metric_keys(rows, x_key=x_key)
        if not metrics:
            return [self._table_spec(rows, nrql=nrql, account_id=account_id, entity_guid=entity_guid, title=title, time_range=time_range)]

        by_unit: dict[str, list[str]] = defaultdict(list)
        for key in metrics:
            by_unit[detect_unit(key)].append(key)

        if len(by_unit) > 2:
            specs = []
            for unit, keys in by_unit.items():
                specs.append(
                    self._chart_spec(
                        rows,
                        x_key=x_key,
                        x_type=x_type,
                        metric_names=keys,
                        nrql=nrql,
                        account_id=account_id,
                        entity_guid=entity_guid,
                        title=f"{title} · {unit}",
                        chart_type=chart_type,
                        time_range=time_range,
                    )
                )
            return specs

        return [
            self._chart_spec(
                rows,
                x_key=x_key,
                x_type=x_type,
                metric_names=metrics,
                nrql=nrql,
                account_id=account_id,
                entity_guid=entity_guid,
                title=title,
                chart_type=chart_type,
                time_range=time_range,
            )
        ]

    def _chart_spec(
        self,
        rows: list[dict[str, Any]],
        *,
        x_key: str | None,
        x_type: str,
        metric_names: list[str],
        nrql: str | None,
        account_id: int | None,
        entity_guid: str | None,
        title: str,
        chart_type: str | None,
        time_range: dict[str, Any] | None,
    ) -> dict[str, Any]:
        units: list[str] = []
        for metric in metric_names:
            unit = detect_unit(metric)
            if unit not in units:
                units.append(unit)
        axis_for_unit = {unit: "left" if idx == 0 else "right" for idx, unit in enumerate(units[:2])}
        default_type = "line" if x_type == "time" else "bar"
        safe_type = chart_type if chart_type in {"line", "area", "bar", "stacked_bar", "scatter", "timeline"} else default_type
        series = []
        y_fields = []
        for metric in metric_names:
            unit = detect_unit(metric)
            axis = axis_for_unit.get(unit, "left")
            y_fields.append({"key": metric, "label": label_for_key(metric), "unit": unit, "axis": axis})
            series.append(
                {
                    "label": label_for_key(metric),
                    "key": metric,
                    "unit": unit,
                    "axis": axis,
                    "data": [
                        {"x": normalize_time_value(row.get(x_key)) if x_key else idx, "y": row.get(metric)}
                        for idx, row in enumerate(rows)
                    ],
                }
            )
        primary_unit = detect_unit(metric_names[0]) if metric_names else "custom"
        return {
            "id": str(uuid.uuid4()),
            "type": safe_type,
            "title": title,
            "subtitle": self._subtitle(rows, metric_names, units),
            "description": "Generado desde datos reales devueltos por New Relic. Las columnas de tiempo e IDs quedan excluidas de las series Y. Las fechas se normalizan y muestran en UTC para coincidir con la base temporal NRQL.",
            "unit": primary_unit,
            "x": {"key": x_key or "index", "type": x_type, "label": "Hora (UTC)" if x_type == "time" else label_for_key(x_key or "Index")},
            "y": y_fields,
            "series": series,
            "rows": rows,
            "columns": columns_for_rows(rows),
            "meta": {
                "nrql": nrql,
                "account_id": account_id,
                "entity_guid": entity_guid,
                "time_range": time_range,
                "generated_at": datetime.now(tz=timezone.utc).isoformat(),
                "excluded_y_columns": [key for key in rows[0].keys() if is_time_key(key) or is_id_key(key)] if rows else [],
                "dual_axis": len(units) == 2,
                "time_basis": "UTC",
            },
        }

    def _table_spec(
        self,
        rows: list[dict[str, Any]],
        *,
        nrql: str | None,
        account_id: int | None,
        entity_guid: str | None,
        title: str,
        time_range: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return {
            "id": str(uuid.uuid4()),
            "type": "table",
            "title": title,
            "subtitle": "No hay métricas numéricas seguras para graficar" if rows else "New Relic no devolvió filas para este rango",
            "description": "Se muestra una tabla para evitar una visualización engañosa.",
            "unit": "custom",
            "x": None,
            "y": [],
            "series": [],
            "rows": rows,
            "columns": columns_for_rows(rows),
            "meta": {"nrql": nrql, "account_id": account_id, "entity_guid": entity_guid, "time_range": time_range, "generated_at": datetime.now(tz=timezone.utc).isoformat(), "time_basis": "UTC"},
        }

    @staticmethod
    def _subtitle(rows: list[dict[str, Any]], metrics: Iterable[str], units: list[str]) -> str:
        metrics_label = ", ".join(metrics)
        unit_label = " + ".join(units)
        return f"{len(rows)} puntos · {metrics_label} · unidades: {unit_label}"
