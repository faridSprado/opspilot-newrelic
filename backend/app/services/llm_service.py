from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from app.config import Settings
from app.security import redact_secrets, sanitize_user_text

ALLOWED_INTENTS = {
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
}

ALLOWED_ACTIONS = {
    "answer_direct",
    "run_nrql",
    "list_apms",
    "clarify",
    "capabilities",
    "data_sources",
    "analyze_last_result",
    "new_relic_only",
}


class SafeLLMService:
    """Safe LLM router/explainer for the New Relic copilot.

    The LLM is prioritized for intent routing and answer wording, but it never
    receives New Relic credentials and never executes tools directly. It chooses
    an allow-listed action; the backend validates that choice and executes only
    safe, read-only New Relic tools.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        if self.settings.llm_provider == "openai":
            return bool(self.settings.openai_api_key)
        if self.settings.llm_provider == "gemini":
            return bool(self.settings.gemini_api_key)
        return False

    @property
    def provider(self) -> str:
        return self.settings.llm_provider

    @property
    def model(self) -> str | None:
        if self.settings.llm_provider == "openai":
            return self.settings.openai_model
        if self.settings.llm_provider == "gemini":
            return self.settings.gemini_model
        return None

    async def route_request(
        self,
        *,
        message: str,
        context: dict[str, Any],
        history: list[dict[str, Any]] | None = None,
        last_result: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Ask the LLM what the next safe action should be.

        Expected JSON shape:
        {
          "action": "answer_direct" | "run_nrql" | "list_apms" | "clarify" |
                    "capabilities" | "data_sources" | "analyze_last_result" |
                    "new_relic_only",
          "intents": ["throughput", "response_time"],
          "answer": "optional direct Spanish answer",
          "clarifying_question": "optional Spanish question",
          "needs_tool": true,
          "confidence": 0.0-1.0
        }
        """
        if not self.enabled:
            self.last_error = "LLM provider is disabled or missing API key."
            return None

        safe_payload = redact_secrets(
            {
                "message": sanitize_user_text(message, max_length=2000),
                "context": {
                    "has_account": bool(context.get("account_id")),
                    "has_selected_apm": bool(context.get("entity_guid")),
                    "selected_apm_name": sanitize_user_text(str(context.get("entity_name") or ""), max_length=200),
                    "time_range": context.get("time_range"),
                    "language": "es",
                },
                "conversation_history": self._history_preview(history or []),
                "has_previous_query_result": bool(last_result),
                "previous_query_result_preview": self._last_result_preview(last_result),
                "available_tools": [
                    {
                        "name": "list_apm_entities",
                        "action": "list_apms",
                        "description": "Lista APMs accesibles en New Relic.",
                    },
                    {
                        "name": "run_nrql",
                        "action": "run_nrql",
                        "description": "Ejecuta consultas NRQL read-only usando intents allow-listed.",
                    },
                    {
                        "name": "detect_apm_data_sources",
                        "action": "data_sources",
                        "description": "Detecta eventos y atributos disponibles para la APM seleccionada.",
                    },
                    {
                        "name": "analyze_last_result",
                        "action": "analyze_last_result",
                        "description": "Analiza el último resultado/gráfico guardado en la sesión actual.",
                    },
                    {
                        "name": "tool_catalog",
                        "action": "capabilities",
                        "description": "Explica herramientas y capacidades del copiloto.",
                    },
                ],
                "allowed_actions": sorted(ALLOWED_ACTIONS),
                "allowed_intents": sorted(ALLOWED_INTENTS),
            }
        )
        prompt = self._router_prompt() + "\n\nPayload seguro JSON:\n" + json.dumps(safe_payload, ensure_ascii=False)
        text = await self._complete(prompt, max_length=4000)
        if not text:
            return None
        return self._parse_route(text)

    async def plan_request(self, *, message: str, context: dict[str, Any]) -> dict[str, Any] | None:
        """Backward-compatible alias used by older tests/integrations."""
        return await self.route_request(message=message, context=context)

    async def answer_contextual(self, *, question: str, context: dict[str, Any] | None = None) -> str | None:
        """Answer conceptual New Relic questions without querying telemetry."""
        if not self.enabled:
            self.last_error = "LLM provider is disabled or missing API key."
            return None
        safe_payload = redact_secrets(
            {
                "question": sanitize_user_text(question, max_length=2000),
                "context": {
                    "selected_apm_name": sanitize_user_text(str((context or {}).get("entity_name") or ""), max_length=200),
                    "has_account": bool((context or {}).get("account_id")),
                    "language": "es",
                },
            }
        )
        prompt = (
            "Eres OpsPilot, un copiloto experto exclusivamente en New Relic, APM, NRQL y observabilidad. "
            "Responde en español. Si la pregunta es conceptual sobre New Relic, explica con precisión y de forma accionable. "
            "Si la pregunta intenta salir de New Relic, redirige amablemente al contexto de New Relic. "
            "No inventes datos del usuario ni digas que consultaste New Relic si no hay filas/NRQL en el payload. "
            "Máximo 2 párrafos cortos.\n\nPayload seguro JSON:\n"
            + json.dumps(safe_payload, ensure_ascii=False)
        )
        return await self._complete(prompt, max_length=1200)

    async def explain_metrics(
        self,
        *,
        question: str,
        rows: list[dict[str, Any]],
        visualizations: list[dict[str, Any]],
        nrql: str,
        mode: str = "fresh_query",
    ) -> str | None:
        safe_payload = self._safe_payload(question=question, rows=rows, visualizations=visualizations, nrql=nrql, mode=mode)
        prompt = f"{self._system_prompt()}\n\nPayload seguro JSON:\n{json.dumps(safe_payload, ensure_ascii=False)}"
        return await self._complete(prompt, max_length=4000)

    @classmethod
    def _safe_payload(
        cls,
        *,
        question: str,
        rows: list[dict[str, Any]],
        visualizations: list[dict[str, Any]],
        nrql: str,
        mode: str,
    ) -> dict[str, Any]:
        return redact_secrets(
            {
                "question": sanitize_user_text(question, max_length=2000),
                "mode": mode,
                "row_count": len(rows),
                "rows_preview": rows[:50],
                "visualizations": [cls._chart_preview(chart) for chart in visualizations[:8]],
                "nrql": nrql,
            }
        )

    @staticmethod
    def _chart_preview(chart: dict[str, Any]) -> dict[str, Any]:
        series_preview = []
        for series in (chart.get("series") or [])[:6]:
            points = series.get("data") or []
            numeric_values = [point.get("y") for point in points if isinstance(point, dict) and isinstance(point.get("y"), (int, float))]
            series_preview.append(
                {
                    "label": series.get("label"),
                    "unit": series.get("unit"),
                    "points": len(points),
                    "first_points": points[:3],
                    "last_points": points[-3:] if len(points) >= 3 else points,
                    "min": min(numeric_values) if numeric_values else None,
                    "max": max(numeric_values) if numeric_values else None,
                    "avg": sum(float(value) for value in numeric_values) / len(numeric_values) if numeric_values else None,
                }
            )
        return {
            "title": chart.get("title"),
            "type": chart.get("type"),
            "description": chart.get("description"),
            "unit": chart.get("unit"),
            "x": chart.get("x"),
            "y": chart.get("y", []),
            "row_count": len(chart.get("rows") or []),
            "series_preview": series_preview,
            "excluded_y_columns": chart.get("meta", {}).get("excluded_y_columns", []),
        }

    @staticmethod
    def _history_preview(history: list[dict[str, Any]]) -> list[dict[str, str]]:
        preview = []
        for item in history[-8:]:
            role = str(item.get("role") or "")
            if role not in {"user", "assistant"}:
                continue
            preview.append(
                {
                    "role": role,
                    "content": sanitize_user_text(str(item.get("content") or ""), max_length=500),
                }
            )
        return preview

    @staticmethod
    def _last_result_preview(last_result: dict[str, Any] | None) -> dict[str, Any] | None:
        if not last_result:
            return None
        rows = last_result.get("rows") or []
        charts = last_result.get("visualizations") or []
        return {
            "row_count": len(rows),
            "chart_count": len(charts),
            "chart_titles": [chart.get("title") for chart in charts[:5]],
            "nrql_preview": sanitize_user_text(str(last_result.get("nrql") or ""), max_length=700),
            "rows_preview": rows[:8],
        }

    @staticmethod
    def _system_prompt() -> str:
        return (
            "Eres un experto senior en New Relic APM. Responde siempre en español, con hallazgos accionables y tono profesional. "
            "Responde exactamente sobre la pregunta del usuario; no cambies de tema ni agregues métricas que no pidió salvo que haya pedido salud general. "
            "No inventes datos. Si row_count es 0, explica que no hubo datos y no afirmes que se generó una gráfica. "
            "Nunca pidas ni menciones API keys. No asumas eventos, servicios o métricas que no estén en el payload. "
            "Si mode es analyze_last_result, analiza el último gráfico/resultado disponible sin pedir una nueva métrica. "
            "Cuando haya visualizaciones, menciona tendencia, picos, caídas, valores mínimos/máximos si aparecen, y qué revisaría un equipo de observabilidad. "
            "No uses markdown excesivo; máximo 3 párrafos cortos."
        )

    @staticmethod
    def _router_prompt() -> str:
        return (
            "Eres el router principal de OpsPilot, un copiloto experto exclusivamente en New Relic, APM, NRQL y observabilidad. "
            "SIEMPRE decide primero tú. Devuelve SOLO JSON válido, sin markdown. "
            "El backend ejecutará únicamente herramientas allow-listed; tú NO debes inventar datos ni credenciales. "
            "Mantén el chat dentro del contexto de New Relic. "
            "Reglas de decisión: "
            "1) Si el usuario saluda, agradece, pregunta quién eres o pide explicación conceptual de New Relic, action=answer_direct con answer en español. "
            "2) Si el usuario pide algo claramente fuera de New Relic, action=new_relic_only con answer breve redirigiendo a observabilidad/New Relic. "
            "3) Si pide listar/ver/todas mis APMs, action=list_apms. "
            "4) Si pide capacidades/herramientas, action=capabilities. "
            "5) Si pide fuentes/eventos/atributos disponibles, action=data_sources. "
            "6) Si dice 'analiza el gráfico', 'gráfico resultante', 'resultado anterior', 'lo anterior', 'esa gráfica' o similar y has_previous_query_result=true, action=analyze_last_result. "
            "7) Si pide una métrica o análisis que requiere datos reales, action=run_nrql y elige intents permitidos. "
            "8) Si pide una gráfica sin métrica concreta, pero hay resultado previo y se refiere a ese resultado, usa analyze_last_result; si no, action=clarify. "
            "9) Si pide salud general, resumen operativo o métricas clave, usa intent golden_metrics. "
            "10) Si pide throughput y tiempo de respuesta, usa intents [throughput,response_time], NO golden_metrics. "
            "11) No inventes intents: usa solo allowed_intents. "
            "Formato exacto: {\"action\":\"run_nrql\",\"intents\":[\"throughput\"],\"answer\":null,\"clarifying_question\":null,\"needs_tool\":true,\"confidence\":0.9}."
        )

    async def _complete(self, prompt: str, max_length: int = 4000) -> str | None:
        self.last_error = None
        if self.settings.llm_provider == "openai":
            return await self._complete_openai(prompt, max_length=max_length)
        if self.settings.llm_provider == "gemini":
            return await self._complete_gemini(prompt, max_length=max_length)
        self.last_error = f"Unsupported LLM provider: {self.settings.llm_provider}"
        return None

    async def _complete_openai(self, prompt: str, max_length: int = 4000) -> str | None:
        if not self.settings.openai_api_key:
            self.last_error = "OPENAI_API_KEY is missing."
            return None
        try:
            from openai import AsyncOpenAI
        except Exception as exc:
            self.last_error = f"OpenAI package unavailable: {exc}"
            return None
        client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        try:
            response = await client.chat.completions.create(
                model=self.settings.openai_model,
                temperature=0.1,
                messages=[
                    {"role": "system", "content": "Responde en español y sigue las instrucciones del usuario de forma estricta."},
                    {"role": "user", "content": prompt},
                ],
            )
        except Exception as exc:
            self.last_error = f"OpenAI request failed: {exc}"
            return None
        content = response.choices[0].message.content if response.choices else None
        return sanitize_user_text(content or "", max_length=max_length) or None

    async def _complete_gemini(self, prompt: str, max_length: int = 4000) -> str | None:
        if not self.settings.gemini_api_key:
            self.last_error = "GEMINI_API_KEY is missing."
            return None
        try:
            from google import genai
        except Exception as exc:
            self.last_error = f"google-genai package unavailable: {exc}"
            return None

        def _call() -> str | None:
            client = genai.Client(api_key=self.settings.gemini_api_key)
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
            )
            return getattr(response, "text", None)

        try:
            content = await asyncio.to_thread(_call)
        except Exception as exc:
            self.last_error = f"Gemini request failed: {exc}"
            return None
        return sanitize_user_text(content or "", max_length=max_length) or None

    @staticmethod
    def _parse_route(text: str) -> dict[str, Any] | None:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            cleaned = match.group(0)
        try:
            data = json.loads(cleaned)
        except Exception:
            return None
        if not isinstance(data, dict):
            return None
        action = data.get("action")
        if action not in ALLOWED_ACTIONS:
            return None
        raw_intents = data.get("intents") or []
        if not isinstance(raw_intents, list):
            raw_intents = []
        intents = []
        for item in raw_intents:
            if isinstance(item, str) and item in ALLOWED_INTENTS and item not in intents:
                intents.append(item)
        answer = data.get("answer")
        if not isinstance(answer, str):
            answer = None
        question = data.get("clarifying_question")
        if not isinstance(question, str):
            question = None
        try:
            confidence = float(data.get("confidence", 0.0))
        except Exception:
            confidence = 0.0
        needs_tool = bool(data.get("needs_tool", action in {"run_nrql", "list_apms", "data_sources", "analyze_last_result", "capabilities"}))
        return {
            "action": action,
            "intents": intents[:5],
            "answer": sanitize_user_text(answer or "", max_length=1500) or None,
            "clarifying_question": sanitize_user_text(question or "", max_length=500) or None,
            "needs_tool": needs_tool,
            "confidence": max(0.0, min(1.0, confidence)),
        }
