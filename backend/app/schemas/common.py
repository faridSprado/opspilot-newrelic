from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TimeRange(BaseModel):
    since: str = Field(default="3 hours ago")
    until: str | None = None
    timezone: str | None = Field(default="UTC")
    step: str | None = Field(default="1 minute")


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ToolResponse(BaseModel):
    ok: bool
    source: str = "new_relic"
    account_id: int | None = None
    entity_guid: str | None = None
    nrql: str | None = None
    time_range: TimeRange | None = None
    data: dict[str, Any] = Field(default_factory=lambda: {"rows": []})
    visualizations: list[dict[str, Any]] = Field(default_factory=list)
    error: ErrorEnvelope | None = None


class AxisField(BaseModel):
    key: str
    label: str
    unit: str
    axis: Literal["left", "right"] = "left"


class ChartAxis(BaseModel):
    key: str
    type: Literal["time", "category", "number"] = "category"
    label: str


class ChartSeries(BaseModel):
    label: str
    key: str
    unit: str
    axis: Literal["left", "right"] = "left"
    data: list[Any] = Field(default_factory=list)


class ChartSpec(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: Literal[
        "line",
        "area",
        "bar",
        "stacked_bar",
        "pie",
        "donut",
        "scatter",
        "heatmap",
        "table",
        "metric_cards",
        "timeline",
    ]
    title: str
    subtitle: str | None = None
    description: str | None = None
    unit: str = "custom"
    x: ChartAxis | None = None
    y: list[AxisField] = Field(default_factory=list)
    series: list[ChartSeries] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
