from __future__ import annotations

import re
import statistics
from typing import Any

from app.schemas.common import ToolResponse
from app.services.newrelic_client import NewRelicClient, NewRelicClientError
from app.services.nrql_builder import NrqlBuilder
from app.services.visualization_engine import VisualizationEngine


TOOL_CATALOG: list[dict[str, str]] = [
    {"name": "validate_new_relic_credentials", "category": "conexión", "description": "Valida User API Key, región y acceso a cuentas."},
    {"name": "list_accounts", "category": "inventario", "description": "Lista cuentas accesibles para la API key."},
    {"name": "list_apm_entities", "category": "inventario", "description": "Lista APMs con paginación, cuenta, severidad, reporting y tags."},
    {"name": "search_entities", "category": "inventario", "description": "Busca entidades por nombre, dominio o metadatos."},
    {"name": "get_entity_details", "category": "inventario", "description": "Obtiene detalle de entidad APM y fuentes de datos detectadas."},
    {"name": "detect_apm_data_sources", "category": "diagnóstico", "description": "Detecta Transaction, TransactionError, Span, Metric y Log para una APM."},
    {"name": "run_nrql", "category": "nrql", "description": "Ejecuta NRQL read-only y genera ChartSpec seguro."},
    {"name": "get_golden_metrics", "category": "métricas", "description": "Throughput, respuesta, tasa de error y Apdex minuto a minuto."},
    {"name": "get_key_transactions", "category": "transacciones", "description": "Top transacciones con llamadas, latencia, percentiles y error rate."},
    {"name": "get_transactions", "category": "transacciones", "description": "Transacciones más lentas por promedio y percentiles."},
    {"name": "get_transaction_throughput", "category": "transacciones", "description": "Throughput por transacción minuto a minuto."},
    {"name": "get_transaction_response_time", "category": "transacciones", "description": "Tiempo de respuesta por transacción minuto a minuto."},
    {"name": "get_transaction_error_rate", "category": "transacciones", "description": "Tasa de error por transacción minuto a minuto."},
    {"name": "get_errors", "category": "errores", "description": "Errores por clase."},
    {"name": "get_error_messages", "category": "errores", "description": "Errores por clase y mensaje."},
    {"name": "get_error_traces", "category": "errores", "description": "Resumen de trazas de error y último mensaje."},
    {"name": "get_external_services", "category": "dependencias", "description": "Dependencias externas por duración y llamadas."},
    {"name": "get_external_failures", "category": "dependencias", "description": "Fallos en dependencias externas."},
    {"name": "get_database_metrics", "category": "base de datos", "description": "Duración DB y llamadas."},
    {"name": "get_database_operations", "category": "base de datos", "description": "Operaciones DB por transacción."},
    {"name": "get_deployments", "category": "deploys", "description": "Despliegues recientes."},
    {"name": "get_deploy_impact", "category": "deploys", "description": "Impacto de deploys en latencia, throughput y errores."},
    {"name": "get_alerts", "category": "alertas", "description": "Incidentes y alertas de New Relic AI."},
    {"name": "get_logs", "category": "logs", "description": "Volumen de logs minuto a minuto."},
    {"name": "get_error_logs", "category": "logs", "description": "Logs de error minuto a minuto."},
    {"name": "get_traces", "category": "trazas", "description": "Conteo y duración de spans."},
    {"name": "get_slow_spans", "category": "trazas", "description": "Spans más lentos por nombre."},
    {"name": "get_cpu_memory", "category": "infraestructura", "description": "CPU y memoria cuando SystemSample está disponible."},
    {"name": "get_hosts_instances", "category": "infraestructura", "description": "Hosts, contenedores e instancias observadas."},
    {"name": "get_available_attributes", "category": "schema", "description": "keyset() para atributos consultables de una APM."},
    {"name": "compare_current_vs_previous", "category": "comparación", "description": "Compara el rango actual contra el mismo rango del día anterior."},
    {"name": "compare_entities", "category": "comparación", "description": "Compara varias entidades por latencia y throughput."},
    {"name": "detect_anomalies", "category": "análisis", "description": "Detección básica por z-score sobre datos ya consultados."},
    {"name": "generate_dashboard", "category": "análisis", "description": "Agrupa respuestas de herramientas en un dashboard temporal."},
]


class NewRelicTools:
    def __init__(self, client: NewRelicClient, chart_engine: VisualizationEngine | None = None) -> None:
        self.client = client
        self.chart_engine = chart_engine or VisualizationEngine()

    async def validate_new_relic_credentials(self, account_ids: list[int] | None = None) -> ToolResponse:
        try:
            data = await self.client.validate_credentials(account_ids)
            return ToolResponse(ok=True, data={"rows": data.get("accounts", []), "user": data.get("user")})
        except NewRelicClientError as exc:
            return self._error(exc)

    async def list_accounts(self) -> ToolResponse:
        try:
            accounts = await self.client.list_accounts()
            return ToolResponse(ok=True, data={"rows": accounts})
        except NewRelicClientError as exc:
            return self._error(exc)

    async def list_apm_entities(self, account_ids: list[int] | None = None) -> ToolResponse:
        try:
            data = await self.client.list_apm_entities(account_ids=account_ids)
            return ToolResponse(ok=True, data={"rows": data.get("entities", []), "nextCursor": data.get("nextCursor")})
        except NewRelicClientError as exc:
            return self._error(exc)

    async def search_entities(self, query: str) -> ToolResponse:
        try:
            data = await self.client.entity_search(query)
            return ToolResponse(ok=True, data={"rows": data.get("entities", []), "nextCursor": data.get("nextCursor")})
        except NewRelicClientError as exc:
            return self._error(exc)

    async def get_entity_details(self, guid: str) -> ToolResponse:
        try:
            entity = await self.client.get_entity(guid)
            return ToolResponse(ok=True, entity_guid=guid, data={"rows": [entity] if entity else []})
        except NewRelicClientError as exc:
            return self._error(exc, entity_guid=guid)

    async def run_nrql(self, account_id: int, nrql: str, entity_guid: str | None = None, title: str = "NRQL result", chart_type: str | None = None, time_range: dict[str, Any] | None = None) -> ToolResponse:
        try:
            result = await self.client.run_nrql(account_id, nrql)
            return self._success_nrql_response(account_id, entity_guid, nrql, result, title, chart_type, time_range)
        except NewRelicClientError as exc:
            fallback_nrql = self._auto_timeseries_nrql(nrql)
            if exc.code == "NEW_RELIC_GRAPHQL_ERROR" and fallback_nrql and fallback_nrql != nrql:
                try:
                    result = await self.client.run_nrql(account_id, fallback_nrql)
                    response = self._success_nrql_response(account_id, entity_guid, fallback_nrql, result, title, chart_type, time_range)
                    response.data.setdefault("metadata", {})["fallback_reason"] = "New Relic rechazó el intervalo original; se reintentó con TIMESERIES automático."
                    response.data["original_nrql"] = nrql
                    return response
                except NewRelicClientError:
                    pass
            return self._error(exc, account_id=account_id, entity_guid=entity_guid, nrql=nrql)
        except ValueError as exc:
            return ToolResponse(ok=False, account_id=account_id, entity_guid=entity_guid, nrql=nrql, error={"code": "NRQL_VALIDATION_ERROR", "message": str(exc)})

    def _success_nrql_response(
        self,
        account_id: int,
        entity_guid: str | None,
        nrql: str,
        result: dict[str, Any],
        title: str,
        chart_type: str | None,
        time_range: dict[str, Any] | None,
    ) -> ToolResponse:
        rows = result.get("results", []) or []
        visualizations = self.chart_engine.build_visualizations(
            rows,
            nrql=nrql,
            account_id=account_id,
            entity_guid=entity_guid,
            title=title,
            chart_type=chart_type,
            time_range=time_range,
        )
        return ToolResponse(ok=True, account_id=account_id, entity_guid=entity_guid, nrql=nrql, data={"rows": rows, "metadata": result.get("metadata", {})}, visualizations=visualizations)

    @staticmethod
    def _auto_timeseries_nrql(nrql: str) -> str | None:
        if not re.search(r"\bTIMESERIES\b", nrql, flags=re.IGNORECASE):
            return None
        # Let New Relic choose a safe bucket size when an explicit interval is
        # rejected for wide or custom ranges. This keeps the chart available
        # instead of failing the whole chat turn.
        return re.sub(
            r"\bTIMESERIES\s+\d+\s+(?:second|seconds|sec|s|minute|minutes|min|m|hour|hours|hr|hrs|h|day|days|d)\b",
            "TIMESERIES",
            nrql,
            flags=re.IGNORECASE,
        )

    async def get_golden_metrics(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("golden_metrics", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_apm_summary(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        return await self.get_golden_metrics(account_id, app_name=app_name, entity_guid=entity_guid, since=since)

    async def get_transactions(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("slow_transactions", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_errors(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("errors_by_class", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_external_services(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("external_services", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_database_metrics(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("database", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_deployments(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "7 days ago") -> ToolResponse:
        plan = NrqlBuilder.build("deployments", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_alerts(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "24 hours ago") -> ToolResponse:
        where = NrqlBuilder.where_clause(app_name=app_name, entity_guid=entity_guid)
        time_clause = NrqlBuilder.time_clause(since)
        nrql = f"SELECT count(*) AS 'Incidentes' FROM NrAiIncident WHERE {where} {time_clause} TIMESERIES 1 minute"
        return await self.run_nrql(account_id, nrql, entity_guid=entity_guid, title="Incidentes y alertas", chart_type="bar", time_range={"since": since})

    async def get_logs(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("logs", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_traces(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("traces", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    def tool_catalog(self) -> ToolResponse:
        return ToolResponse(ok=True, data={"rows": TOOL_CATALOG})

    async def detect_apm_data_sources(self, account_id: int, entity_guid: str, since: str = "24 hours ago") -> ToolResponse:
        try:
            metadata = await self.client.detect_apm_data_sources(account_id, entity_guid, since=since)
            return ToolResponse(ok=True, account_id=account_id, entity_guid=entity_guid, data={"rows": metadata.get("data_sources", []), "metadata": metadata})
        except NewRelicClientError as exc:
            return self._error(exc, account_id=account_id, entity_guid=entity_guid)

    async def get_key_transactions(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction", transaction_name_attribute: str = "name") -> ToolResponse:
        plan = NrqlBuilder.build("key_transactions", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type, transaction_name_attribute=transaction_name_attribute)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_transaction_throughput(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction", transaction_name_attribute: str = "name") -> ToolResponse:
        plan = NrqlBuilder.build("throughput_by_transaction", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type, transaction_name_attribute=transaction_name_attribute)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_transaction_response_time(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction", transaction_name_attribute: str = "name") -> ToolResponse:
        plan = NrqlBuilder.build("response_time_by_transaction", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type, transaction_name_attribute=transaction_name_attribute)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_transaction_error_rate(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction", transaction_name_attribute: str = "name") -> ToolResponse:
        plan = NrqlBuilder.build("error_rate_by_transaction", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type, transaction_name_attribute=transaction_name_attribute)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_error_messages(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("error_messages", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_error_traces(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("error_traces", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_external_failures(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction") -> ToolResponse:
        plan = NrqlBuilder.build("external_failures", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_database_operations(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction", transaction_name_attribute: str = "name") -> ToolResponse:
        plan = NrqlBuilder.build("database_operations", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type, transaction_name_attribute=transaction_name_attribute)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_deploy_impact(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "24 hours ago", event_type: str = "Transaction") -> ToolResponse:
        plan = NrqlBuilder.build("deployment_impact", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_error_logs(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("logs_errors", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_slow_spans(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("trace_slow_spans", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_cpu_memory(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago") -> ToolResponse:
        plan = NrqlBuilder.build("cpu_memory", app_name=app_name, entity_guid=entity_guid, since=since)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_hosts_instances(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction") -> ToolResponse:
        plan = NrqlBuilder.build("hosts_instances", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def get_available_attributes(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction") -> ToolResponse:
        plan = NrqlBuilder.build("keyset", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    async def compare_current_vs_previous(self, account_id: int, app_name: str | None = None, entity_guid: str | None = None, since: str = "3 hours ago", event_type: str = "Transaction") -> ToolResponse:
        plan = NrqlBuilder.build("current_vs_previous", app_name=app_name, entity_guid=entity_guid, since=since, event_type=event_type)
        return await self.run_nrql(account_id, plan.nrql, entity_guid=entity_guid, title=plan.title, chart_type=plan.chart_type, time_range={"since": since})

    def generate_chart_spec(self, rows: list[dict[str, Any]], nrql: str | None = None, account_id: int | None = None, entity_guid: str | None = None) -> ToolResponse:
        visualizations = self.chart_engine.build_visualizations(rows, nrql=nrql, account_id=account_id, entity_guid=entity_guid, title="Gráfica generada")
        return ToolResponse(ok=True, account_id=account_id, entity_guid=entity_guid, nrql=nrql, data={"rows": rows}, visualizations=visualizations)

    def explain_chart(self, rows: list[dict[str, Any]], chart: dict[str, Any]) -> str:
        if not rows:
            return "New Relic no devolvió datos para este rango. Prueba ampliar el rango o verificar que la entidad reporte el evento consultado."
        metric_labels = [field.get("label") for field in chart.get("y", [])]
        return f"La gráfica muestra {', '.join(metric_labels)} con {len(rows)} filas reales. Las columnas temporales e IDs fueron excluidas de las series Y."

    def create_investigation_summary(self, rows: list[dict[str, Any]], nrql: str) -> dict[str, Any]:
        findings = []
        if rows:
            numeric_keys = [key for key, value in rows[0].items() if isinstance(value, (int, float))]
            for key in numeric_keys:
                values = [float(row[key]) for row in rows if isinstance(row.get(key), (int, float))]
                if values:
                    findings.append({"metric": key, "min": min(values), "max": max(values), "avg": sum(values) / len(values)})
        return {"title": "Resumen de investigación", "summary": "Análisis basado en datos agregados de New Relic.", "findings": findings, "nrql": nrql}

    async def compare_entities(self, account_id: int, entity_names: list[str], since: str = "3 hours ago") -> ToolResponse:
        escaped = ", ".join(f"'{name.replace(chr(39), chr(92)+chr(39))}'" for name in entity_names)
        time_clause = NrqlBuilder.time_clause(since)
        nrql = f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms', rate(count(*), 1 minute) AS 'Throughput RPM' FROM Transaction WHERE appName IN ({escaped}) {time_clause} FACET appName TIMESERIES 1 minute"
        return await self.run_nrql(account_id, nrql, title="Comparación de APMs", time_range={"since": since})

    def detect_anomalies(self, rows: list[dict[str, Any]], metric: str) -> dict[str, Any]:
        values = [float(row[metric]) for row in rows if isinstance(row.get(metric), (int, float))]
        if len(values) < 5:
            return {"ok": True, "metric": metric, "anomalies": [], "reason": "Se requieren al menos 5 puntos para z-score básico."}
        mean = statistics.mean(values)
        stdev = statistics.pstdev(values) or 1.0
        anomalies = []
        for row in rows:
            value = row.get(metric)
            if isinstance(value, (int, float)):
                z = (float(value) - mean) / stdev
                if abs(z) >= 3:
                    anomalies.append({"row": row, "z_score": z})
        return {"ok": True, "metric": metric, "mean": mean, "stdev": stdev, "anomalies": anomalies}

    def generate_dashboard(self, responses: list[ToolResponse]) -> dict[str, Any]:
        charts = []
        rows_total = 0
        for response in responses:
            charts.extend(response.visualizations)
            rows_total += len(response.data.get("rows", [])) if response.data else 0
        return {"title": "Panel temporal", "charts": charts, "rows_total": rows_total}

    @staticmethod
    def _error(exc: NewRelicClientError, account_id: int | None = None, entity_guid: str | None = None, nrql: str | None = None) -> ToolResponse:
        return ToolResponse(ok=False, account_id=account_id, entity_guid=entity_guid, nrql=nrql, error={"code": exc.code, "message": exc.message, "details": exc.details})
