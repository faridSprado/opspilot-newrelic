from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import TimeRange
from app.schemas.entities import EntitySummary


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: str | None = None
    account_id: int | None = Field(default=None, gt=0)
    entity_guid: str | None = None
    entity_name: str | None = None
    transaction_event_type: str | None = None
    transaction_name_attribute: str | None = None
    time_range: TimeRange = Field(default_factory=TimeRange)
    stream: bool = False


class ToolTraceItem(BaseModel):
    tool: str
    input: dict[str, Any] = Field(default_factory=dict)
    ok: bool
    duration_ms: float | None = None
    safe_output_preview: dict[str, Any] = Field(default_factory=dict)


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "tool"]
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ChatResponse(BaseModel):
    ok: bool = True
    session_id: str
    answer: str
    tool_traces: list[ToolTraceItem] = Field(default_factory=list)
    visualizations: list[dict[str, Any]] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    entities: list[EntitySummary] = Field(default_factory=list)
    action: str | None = None
    nrql: str | None = None
    suggestions: list[str] = Field(default_factory=list)
