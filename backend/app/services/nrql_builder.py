from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from app.security import assert_safe_nrql, escape_nrql_string, sanitize_user_text

Intent = Literal[
    "throughput",
    "response_time",
    "golden_metrics",
    "error_rate",
    "apdex",
    "slow_transactions",
    "percentiles",
    "errors_by_class",
    "error_messages",
    "error_traces",
    "deployments",
    "deployment_impact",
    "external_services",
    "external_failures",
    "database",
    "database_operations",
    "logs",
    "logs_errors",
    "traces",
    "trace_slow_spans",
    "cpu_memory",
    "hosts_instances",
    "key_transactions",
    "throughput_by_transaction",
    "response_time_by_transaction",
    "error_rate_by_transaction",
    "current_vs_previous",
    "keyset",
]

FIVE_MINUTES = 5 * 60
MAX_TIMESERIES_BUCKETS = 320



@dataclass(slots=True)
class NrqlPlan:
    intent: Intent
    nrql: str
    title: str
    chart_type: str = "line"


class NrqlBuilder:
    @staticmethod
    def where_clause(app_name: str | None = None, entity_guid: str | None = None) -> str:
        if entity_guid:
            return f"entity.guid = '{escape_nrql_string(entity_guid)}'"
        if app_name:
            return f"appName = '{escape_nrql_string(app_name)}'"
        return "true"

    @staticmethod
    def normalize_time_literal(value: str | None, fallback: str | None = None) -> str:
        cleaned = sanitize_user_text(value or fallback or "", max_length=160).strip()
        if not cleaned:
            return fallback or ""
        return cleaned

    @staticmethod
    def floor_to_five_minutes(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc).replace(second=0, microsecond=0)
        minute = (dt.minute // 5) * 5
        return dt.replace(minute=minute)

    @staticmethod
    def nrql_datetime(dt: datetime) -> str:
        dt = dt.astimezone(timezone.utc).replace(second=0, microsecond=0)
        return "'" + dt.strftime("%Y-%m-%dT%H:%M:%SZ") + "'"

    @staticmethod
    def parse_absolute_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        cleaned = sanitize_user_text(value, max_length=160).strip().strip("'").strip('"')
        if not cleaned:
            return None
        try:
            parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def relative_delta(value: str | None) -> timedelta | None:
        cleaned = sanitize_user_text(value or "", max_length=120).strip().lower()
        if not cleaned:
            return None
        match = re.fullmatch(r"(\d+)\s*(minute|minutes|min|m|hour|hours|hr|hrs|h|day|days|d)\s*ago", cleaned)
        if not match:
            return None
        amount = int(match.group(1))
        unit = match.group(2)
        if unit in {"minute", "minutes", "min", "m"}:
            return timedelta(minutes=amount)
        if unit in {"hour", "hours", "hr", "hrs", "h"}:
            return timedelta(hours=amount)
        return timedelta(days=amount)

    @classmethod
    def normalized_time_bounds(cls, since: str | None, until: str | None = None, now: datetime | None = None) -> tuple[str, str | None]:
        reference = cls.floor_to_five_minutes(now or datetime.now(timezone.utc))
        until_dt = cls.parse_absolute_datetime(until)
        if until_dt is None:
            until_dt = reference
        until_dt = cls.floor_to_five_minutes(until_dt)

        delta = cls.relative_delta(since)
        since_dt = cls.parse_absolute_datetime(since)
        if delta is not None:
            since_dt = until_dt - delta
        if since_dt is None:
            return cls.normalize_time_literal(since, "3 hours ago"), cls.nrql_datetime(until_dt)
        since_dt = cls.floor_to_five_minutes(since_dt)
        return cls.nrql_datetime(since_dt), cls.nrql_datetime(until_dt)

    @classmethod
    def time_clause(cls, since: str | None, until: str | None = None, timezone: str | None = "UTC") -> str:
        since_clause, until_clause = cls.normalized_time_bounds(since, until)
        parts = [f"SINCE {since_clause}"]
        if until_clause:
            parts.append(f"UNTIL {until_clause}")
        return " ".join(parts)

    @classmethod
    def estimate_range_seconds(cls, since: str | None, until: str | None = None, now: datetime | None = None) -> float | None:
        reference = cls.floor_to_five_minutes(now or datetime.now(timezone.utc))
        until_dt = cls.parse_absolute_datetime(until) or reference
        until_dt = cls.floor_to_five_minutes(until_dt)

        delta = cls.relative_delta(since)
        since_dt = cls.parse_absolute_datetime(since)
        if delta is not None:
            since_dt = until_dt - delta
        if since_dt is None:
            return None
        since_dt = cls.floor_to_five_minutes(since_dt)
        seconds = (until_dt - since_dt).total_seconds()
        return seconds if seconds > 0 else None

    @staticmethod
    def _parse_step_seconds(step: str | None) -> int | None:
        cleaned = sanitize_user_text(step or "", max_length=80).strip().lower()
        match = re.fullmatch(r"(\d+)\s*(second|seconds|sec|s|minute|minutes|min|m|hour|hours|hr|hrs|h|day|days|d)", cleaned)
        if not match:
            return None
        amount = max(1, int(match.group(1)))
        unit = match.group(2)
        if unit in {"second", "seconds", "sec", "s"}:
            return amount
        if unit in {"minute", "minutes", "min", "m"}:
            return amount * 60
        if unit in {"hour", "hours", "hr", "hrs", "h"}:
            return amount * 60 * 60
        return amount * 24 * 60 * 60

    @staticmethod
    def _format_step(seconds: int) -> str:
        if seconds % 86400 == 0:
            days = seconds // 86400
            return f"{days} day" if days == 1 else f"{days} days"
        if seconds % 3600 == 0:
            hours = seconds // 3600
            return f"{hours} hour" if hours == 1 else f"{hours} hours"
        minutes = max(1, seconds // 60)
        return f"{minutes} minute" if minutes == 1 else f"{minutes} minutes"

    @classmethod
    def timeseries_interval(cls, since: str | None, until: str | None = None, step: str | None = None) -> str:
        range_seconds = cls.estimate_range_seconds(since, until)
        requested_seconds = cls._parse_step_seconds(step)
        if range_seconds and requested_seconds and range_seconds / requested_seconds <= MAX_TIMESERIES_BUCKETS:
            return cls._format_step(requested_seconds)

        if not range_seconds:
            return "5 minutes"

        # Keep New Relic timeseries queries under the bucket limits that often
        # produce GraphQL errors with wide ranges, while retaining enough detail
        # for troubleshooting.
        candidates = [60, 120, 300, 600, 900, 1800, 3600, 7200, 21600, 43200, 86400]
        for candidate in candidates:
            if range_seconds / candidate <= MAX_TIMESERIES_BUCKETS:
                return cls._format_step(candidate)
        return "1 day"

    @classmethod
    def timeseries_clause(cls, since: str | None, until: str | None = None, step: str | None = None) -> str:
        return f"TIMESERIES {cls.timeseries_interval(since, until, step)}"

    @staticmethod
    def _safe_event_type(event_type: str) -> str:
        return event_type if event_type in {"Transaction", "Span", "Metric"} else "Transaction"

    @staticmethod
    def _safe_name_attr(transaction_name_attribute: str) -> str:
        return transaction_name_attribute if transaction_name_attribute in {"name", "transactionName", "request.uri", "metricName"} else "name"

    @classmethod
    def build(
        cls,
        intent: Intent,
        app_name: str | None = None,
        entity_guid: str | None = None,
        since: str = "3 hours ago",
        until: str | None = None,
        timezone: str | None = "UTC",
        event_type: str = "Transaction",
        transaction_name_attribute: str = "name",
        step: str | None = None,
    ) -> NrqlPlan:
        safe_event_type = cls._safe_event_type(event_type)
        safe_name_attr = cls._safe_name_attr(transaction_name_attribute)
        where = cls.where_clause(app_name=app_name, entity_guid=entity_guid)
        time_clause = cls.time_clause(since, until=until, timezone=timezone)
        timeseries = cls.timeseries_clause(since, until=until, step=step)
        transaction_name = safe_name_attr
        plans: dict[Intent, NrqlPlan] = {
            "throughput": NrqlPlan("throughput", f"SELECT rate(count(*), 1 minute) AS 'Throughput RPM' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Throughput minuto a minuto"),
            "response_time": NrqlPlan("response_time", f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Tiempo de respuesta minuto a minuto"),
            "golden_metrics": NrqlPlan("golden_metrics", f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms', rate(count(*), 1 minute) AS 'Throughput RPM', percentage(count(*), WHERE error IS true) AS 'Tasa de error %', apdex(duration, t: 0.5) AS 'Apdex' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Métricas clave minuto a minuto"),
            "error_rate": NrqlPlan("error_rate", f"SELECT percentage(count(*), WHERE error IS true) AS 'Tasa de error %' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Tasa de error minuto a minuto"),
            "apdex": NrqlPlan("apdex", f"SELECT apdex(duration, t: 0.5) AS 'Apdex' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Apdex minuto a minuto"),
            "slow_transactions": NrqlPlan("slow_transactions", f"SELECT average(duration) * 1000 AS 'Tiempo promedio ms', percentile(duration * 1000, 95, 99), count(*) AS 'Llamadas' FROM {safe_event_type} WHERE {where} {time_clause} FACET {transaction_name} LIMIT 20", "Transacciones más lentas", "bar"),
            "key_transactions": NrqlPlan("key_transactions", f"SELECT count(*) AS 'Llamadas', average(duration) * 1000 AS 'Tiempo promedio ms', percentile(duration * 1000, 95, 99), percentage(count(*), WHERE error IS true) AS 'Tasa de error %' FROM {safe_event_type} WHERE {where} {time_clause} FACET {transaction_name} LIMIT 20", "Transacciones clave", "bar"),
            "throughput_by_transaction": NrqlPlan("throughput_by_transaction", f"SELECT rate(count(*), 1 minute) AS 'Throughput RPM' FROM {safe_event_type} WHERE {where} {time_clause} FACET {transaction_name} LIMIT 10 {timeseries}", "Throughput por transacción"),
            "response_time_by_transaction": NrqlPlan("response_time_by_transaction", f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms' FROM {safe_event_type} WHERE {where} {time_clause} FACET {transaction_name} LIMIT 10 {timeseries}", "Tiempo de respuesta por transacción"),
            "error_rate_by_transaction": NrqlPlan("error_rate_by_transaction", f"SELECT percentage(count(*), WHERE error IS true) AS 'Tasa de error %' FROM {safe_event_type} WHERE {where} {time_clause} FACET {transaction_name} LIMIT 10 {timeseries}", "Tasa de error por transacción"),
            "percentiles": NrqlPlan("percentiles", f"SELECT percentile(duration * 1000, 50, 75, 90, 95, 99) FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Percentiles de latencia minuto a minuto"),
            "errors_by_class": NrqlPlan("errors_by_class", f"SELECT count(*) AS 'Errores' FROM TransactionError WHERE {where} {time_clause} FACET error.class LIMIT 20", "Errores por clase", "bar"),
            "error_messages": NrqlPlan("error_messages", f"SELECT count(*) AS 'Errores', latest(error.message) AS 'Último mensaje' FROM TransactionError WHERE {where} {time_clause} FACET error.class, error.message LIMIT 20", "Errores por clase y mensaje", "bar"),
            "error_traces": NrqlPlan("error_traces", f"SELECT count(*) AS 'Errores', latest(error.message) AS 'Último mensaje', latest(error.expected) AS 'Esperado' FROM TransactionError WHERE {where} {time_clause} FACET error.class LIMIT 20", "Trazas de error resumidas", "bar"),
            "deployments": NrqlPlan("deployments", f"SELECT latest(deploymentId) AS 'ID de despliegue', latest(revision) AS 'Revisión', latest(description) AS 'Descripción' FROM Deployment WHERE {where} {time_clause} FACET timestamp LIMIT 20", "Despliegues recientes", "timeline"),
            "deployment_impact": NrqlPlan("deployment_impact", f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms', percentage(count(*), WHERE error IS true) AS 'Tasa de error %', rate(count(*), 1 minute) AS 'Throughput RPM' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Impacto operativo en el rango"),
            "external_services": NrqlPlan("external_services", f"SELECT average(externalDuration) * 1000 AS 'Duración externa ms', count(*) AS 'Llamadas externas' FROM {safe_event_type} WHERE {where} AND externalDuration IS NOT NULL {time_clause} FACET external.host LIMIT 20", "Dependencias externas", "bar"),
            "external_failures": NrqlPlan("external_failures", f"SELECT count(*) AS 'Errores externos', average(externalDuration) * 1000 AS 'Duración externa ms' FROM {safe_event_type} WHERE {where} AND external.host IS NOT NULL AND error IS true {time_clause} FACET external.host LIMIT 20", "Fallos en dependencias externas", "bar"),
            "database": NrqlPlan("database", f"SELECT average(databaseDuration) * 1000 AS 'Duración de base de datos ms', count(*) AS 'Llamadas DB' FROM {safe_event_type} WHERE {where} AND databaseDuration IS NOT NULL {time_clause} FACET databaseCallCount LIMIT 20", "Métricas de base de datos", "bar"),
            "database_operations": NrqlPlan("database_operations", f"SELECT average(databaseDuration) * 1000 AS 'Duración DB ms', sum(databaseCallCount) AS 'Llamadas DB', count(*) AS 'Transacciones' FROM {safe_event_type} WHERE {where} AND databaseDuration IS NOT NULL {time_clause} FACET {transaction_name} LIMIT 20", "Operaciones de base de datos por transacción", "bar"),
            "logs": NrqlPlan("logs", f"SELECT count(*) AS 'Logs' FROM Log WHERE {where} {time_clause} {timeseries}", "Logs minuto a minuto"),
            "logs_errors": NrqlPlan("logs_errors", f"SELECT count(*) AS 'Logs de error' FROM Log WHERE {where} AND (level = 'error' OR level = 'ERROR' OR message LIKE '%error%') {time_clause} {timeseries}", "Logs de error minuto a minuto"),
            "traces": NrqlPlan("traces", f"SELECT count(*) AS 'Spans', average(duration) * 1000 AS 'Duración de span ms' FROM Span WHERE {where} {time_clause} {timeseries}", "Trazas minuto a minuto"),
            "trace_slow_spans": NrqlPlan("trace_slow_spans", f"SELECT average(duration) * 1000 AS 'Duración span ms', count(*) AS 'Spans' FROM Span WHERE {where} {time_clause} FACET name LIMIT 20", "Spans más lentos", "bar"),
            "cpu_memory": NrqlPlan("cpu_memory", f"SELECT average(cpuPercent) AS 'CPU %', average(memoryUsedBytes) AS 'Memoria bytes' FROM SystemSample WHERE {where} {time_clause} {timeseries}", "CPU y memoria minuto a minuto"),
            "hosts_instances": NrqlPlan("hosts_instances", f"SELECT uniqueCount(host) AS 'Hosts', uniqueCount(containerId) AS 'Contenedores', uniqueCount(instanceName) AS 'Instancias' FROM {safe_event_type} WHERE {where} {time_clause} {timeseries}", "Hosts e instancias"),
            "current_vs_previous": NrqlPlan("current_vs_previous", f"SELECT average(duration) * 1000 AS 'Tiempo de respuesta ms', rate(count(*), 1 minute) AS 'Throughput RPM', percentage(count(*), WHERE error IS true) AS 'Tasa de error %' FROM {safe_event_type} WHERE {where} {time_clause} COMPARE WITH 1 day ago {timeseries}", "Comparación contra el periodo anterior"),
            "keyset": NrqlPlan("keyset", f"SELECT keyset() FROM {safe_event_type} WHERE {where} {time_clause}", "Atributos disponibles", "table"),
        }
        plan = plans[intent]
        plan.nrql = assert_safe_nrql(plan.nrql)
        return plan

    @staticmethod
    def _has_any(lower: str, words: list[str]) -> bool:
        return any(word in lower for word in words)

    @classmethod
    def infer_intents(cls, message: str) -> list[Intent]:
        """Infer one or more exact intents from the user request.

        This keeps the response aligned with what the user explicitly asked.
        For example, "throughput y tiempo de respuesta" becomes exactly two
        charts instead of a broad golden-metrics bundle.
        """
        lower = message.lower()
        intents: list[Intent] = []

        def add(intent: Intent) -> None:
            if intent not in intents:
                intents.append(intent)

        if cls._has_any(lower, ["keyset", "atributo", "schema", "esquema", "fuentes de datos", "inventario"]):
            return ["keyset"]
        if cls._has_any(lower, ["compare", "compara", "vs", "contra ayer", "hoy vs ayer", "periodo anterior"]):
            return ["current_vs_previous"]
        if cls._has_any(lower, ["cpu", "memoria", "memory", "heap", "ram"]):
            add("cpu_memory")
        if cls._has_any(lower, ["host", "hosts", "instancia", "instancias", "instance", "contenedor", "container"]):
            add("hosts_instances")
        if cls._has_any(lower, ["span lento", "slow span", "traza lenta", "trace lento"]):
            add("trace_slow_spans")
        elif cls._has_any(lower, ["trace", "span", "traza"]):
            add("traces")
        if cls._has_any(lower, ["log de error", "logs de error", "errores en logs"]):
            add("logs_errors")
        elif "log" in lower:
            add("logs")
        if cls._has_any(lower, ["database", "db", "base de datos", "sql", "query lenta", "consulta lenta"]):
            add("database_operations" if cls._has_any(lower, ["operacion", "operación", "transaccion", "transacción", "lenta", "lento"]) else "database")
        if cls._has_any(lower, ["external", "dependencia", "externo", "tercero", "http externo"]):
            add("external_failures" if cls._has_any(lower, ["fallo", "falla", "error", "errores"]) else "external_services")
        if cls._has_any(lower, ["deploy", "despliegue", "release"]):
            add("deployment_impact" if cls._has_any(lower, ["impacto", "despues", "después", "regresion", "regresión"]) else "deployments")
        if cls._has_any(lower, ["error message", "mensaje de error", "error.message", "mensajes"]):
            add("error_messages")
        elif cls._has_any(lower, ["error trace", "traza de error", "stack"]):
            add("error_traces")
        elif cls._has_any(lower, ["error class", "errores por", "error.class", "clase"]):
            add("errors_by_class")
        elif "error" in lower:
            add("error_rate_by_transaction" if cls._has_any(lower, ["endpoint", "transaccion", "transacción"]) else "error_rate")
        if "apdex" in lower:
            add("apdex")
        if cls._has_any(lower, ["p95", "p99", "percentil", "percentile"]):
            add("percentiles")
        if cls._has_any(lower, ["endpoint", "transaction", "transacción", "transaccion"]):
            if cls._has_any(lower, ["throughput", "rpm"]):
                add("throughput_by_transaction")
            elif cls._has_any(lower, ["response", "respuesta", "latencia", "latency", "duration", "tiempo"]):
                add("response_time_by_transaction")
            else:
                add("key_transactions" if cls._has_any(lower, ["clave", "principal", "top", "todas", "lista", "p95", "p99"]) else "slow_transactions")
        has_throughput = cls._has_any(lower, ["throughput", "rpm", "peticiones", "requests", "request/min", "req/min"])
        has_response = cls._has_any(lower, ["response", "respuesta", "latencia", "latency", "duration", "tiempo de respuesta"])
        if has_throughput:
            add("throughput")
        if has_response:
            add("response_time")
        if cls._has_any(lower, ["salud", "health", "resumen", "general", "métricas clave", "metricas clave", "golden", "todo", "toda la informacion", "toda la información", "estado de la apm"]):
            if not intents:
                add("golden_metrics")
        return intents

    @classmethod
    def infer_intent(cls, message: str) -> Intent:
        intents = cls.infer_intents(message)
        return intents[0] if intents else "golden_metrics"
