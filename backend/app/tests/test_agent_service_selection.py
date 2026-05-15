import pytest

from app.schemas.chat import ChatRequest
from app.schemas.common import ToolResponse
from app.services.agent_service import AgentService


class FakeTools:
    def __init__(self):
        self.queries = []

    async def list_apm_entities(self, account_ids=None):
        return ToolResponse(ok=True, data={"rows": [
            {"guid": "guid-1", "accountId": 123, "name": "checkout-api", "domain": "APM", "type": "APPLICATION", "alertSeverity": "NOT_ALERTING", "reporting": True},
            {"guid": "guid-2", "accountId": 123, "name": "payments-api", "domain": "APM", "type": "APPLICATION", "alertSeverity": "CRITICAL", "reporting": True},
        ]})

    async def run_nrql(self, account_id, nrql, entity_guid=None, title=None, chart_type="line", time_range=None):
        self.queries.append(nrql)
        return ToolResponse(ok=True, account_id=account_id, entity_guid=entity_guid, nrql=nrql, data={"rows": [{"beginTimeSeconds": 1710000000, title or "metric": 1.0}]}, visualizations=[{"id": title or "chart", "title": title or "chart"}])

    def tool_catalog(self):
        return ToolResponse(ok=True, data={"rows": []})


@pytest.mark.asyncio
async def test_list_apms_returns_selectable_entities():
    service = AgentService(FakeTools())
    response = await service.answer(ChatRequest(message="Lista todas mis APMs", account_id=123))
    assert response.ok is True
    assert response.action == "select_apm"
    assert len(response.entities) == 2
    assert response.entities[0].name == "checkout-api"
    assert "lista" in response.answer.lower() or "apm" in response.answer.lower()


@pytest.mark.asyncio
async def test_metric_question_without_entity_asks_for_selection():
    service = AgentService(FakeTools())
    response = await service.answer(ChatRequest(message="Grafica throughput de las ultimas 3 horas", account_id=123))
    assert response.ok is True
    assert response.action == "select_apm"
    assert response.visualizations == []
    assert len(response.entities) == 2
    assert "necesito una apm" in response.answer.lower()


@pytest.mark.asyncio
async def test_vague_chart_with_entity_asks_for_metric_clarification():
    tools = FakeTools()
    service = AgentService(tools)
    response = await service.answer(ChatRequest(message="Dame la grafica de las ultimas 3 horas", account_id=123, entity_guid="guid-1", entity_name="checkout-api"))
    assert response.ok is True
    assert response.action == "clarify_metric"
    assert response.visualizations == []
    assert tools.queries == []
    assert "qué métrica" in response.answer.lower() or "que métrica" in response.answer.lower()


@pytest.mark.asyncio
async def test_throughput_and_response_time_runs_exactly_two_queries():
    tools = FakeTools()
    service = AgentService(tools)
    response = await service.answer(ChatRequest(message="Grafica throughput y tiempo de respuesta de las ultimas 3 horas", account_id=123, entity_guid="guid-1", entity_name="checkout-api"))
    assert response.ok is True
    assert len(tools.queries) == 2
    assert "Throughput RPM" in tools.queries[0]
    assert "Tiempo de respuesta ms" in tools.queries[1]
    assert all("Apdex" not in query for query in tools.queries)

@pytest.mark.asyncio
async def test_chat_greeting_works_without_new_relic_credentials():
    service = AgentService(None)
    response = await service.answer(ChatRequest(message="Hola"))
    assert response.ok is True
    assert "new relic" in response.answer.lower()
    assert response.action is None


@pytest.mark.asyncio
async def test_conceptual_new_relic_question_does_not_require_credentials():
    service = AgentService(None)
    response = await service.answer(ChatRequest(message="Qué es Apdex en New Relic?"))
    assert response.ok is True
    assert "apdex" in response.answer.lower()
    assert "credenciales" not in response.answer.lower()


@pytest.mark.asyncio
async def test_off_topic_prompt_is_redirected_to_new_relic_context():
    service = AgentService(None)
    response = await service.answer(ChatRequest(message="Cuéntame un chiste"))
    assert response.ok is True
    assert response.action == "new_relic_only"
    assert "new relic" in response.answer.lower()


@pytest.mark.asyncio
async def test_data_question_without_tools_requests_new_relic_session():
    service = AgentService(None)
    response = await service.answer(ChatRequest(message="Grafica throughput", account_id=123, entity_guid="guid-1", entity_name="checkout-api"))
    assert response.ok is False
    assert response.action == "credentials_required"
    assert "sesión de new relic" in response.answer.lower()

@pytest.mark.asyncio
async def test_greeting_plus_metric_still_runs_metric_query():
    tools = FakeTools()
    service = AgentService(tools)
    response = await service.answer(ChatRequest(message="Hola grafica throughput", account_id=123, entity_guid="guid-1", entity_name="checkout-api"))
    assert response.ok is True
    assert len(tools.queries) == 1
    assert "Throughput RPM" in tools.queries[0]

class RoutingLLM:
    def __init__(self, route):
        self.route = route
        self.provider = "gemini"
        self.model = "gemini-2.5-flash"
        self.enabled = True
        self.last_error = None
        self.explain_calls = []

    async def route_request(self, **kwargs):
        return self.route

    async def answer_contextual(self, **kwargs):
        return "Respuesta directa del LLM dentro de New Relic."

    async def explain_metrics(self, *, question, rows, visualizations, nrql, mode="fresh_query"):
        self.explain_calls.append({"question": question, "rows": rows, "visualizations": visualizations, "nrql": nrql, "mode": mode})
        return f"LLM analizó {len(rows)} filas en modo {mode}."


@pytest.mark.asyncio
async def test_llm_can_analyze_previous_chart_result(tmp_path):
    from app.db.session import Database

    db = Database(f"sqlite:///{tmp_path / 'opspilot-test.db'}")
    session_id = db.ensure_chat_session(None, "chart session", selected_entity_guid="guid-1")
    db.save_query_run(
        session_id,
        123,
        "guid-1",
        "SELECT rate(count(*), 1 minute) AS 'Throughput RPM' FROM Transaction TIMESERIES",
        [{"beginTimeSeconds": 1710000000, "Throughput RPM": 12.5}],
        [{"id": "throughput", "title": "Throughput", "type": "line", "rows": [], "series": []}],
    )
    tools = FakeTools()
    service = AgentService(tools, db=db)
    service.llm = RoutingLLM({"action": "analyze_last_result", "intents": [], "answer": None, "confidence": 0.96, "needs_tool": True})

    response = await service.answer(
        ChatRequest(
            message="Haz un análisis del grafico resultante",
            session_id=session_id,
            account_id=123,
            entity_guid="guid-1",
            entity_name="global-prod-indira-sync",
        )
    )

    assert response.ok is True
    assert response.action == "analyze_last_result"
    assert "LLM analizó 1 filas" in response.answer
    assert response.visualizations
    assert tools.queries == []
    assert any(trace.tool == "llm_router" and trace.ok for trace in response.tool_traces)
    assert any(trace.tool == "llm_explain" and trace.safe_output_preview.get("mode") == "analyze_last_result" for trace in response.tool_traces)


@pytest.mark.asyncio
async def test_llm_route_is_prioritized_over_vague_chart_heuristic():
    tools = FakeTools()
    service = AgentService(tools)
    service.llm = RoutingLLM({"action": "run_nrql", "intents": ["golden_metrics"], "answer": None, "confidence": 0.9, "needs_tool": True})

    response = await service.answer(
        ChatRequest(
            message="Hazme el análisis que consideres más útil",
            account_id=123,
            entity_guid="guid-1",
            entity_name="checkout-api",
        )
    )

    assert response.ok is True
    assert response.action != "clarify_metric"
    assert len(tools.queries) == 1
    assert "Apdex" in tools.queries[0]
    assert "LLM analizó" in response.answer
