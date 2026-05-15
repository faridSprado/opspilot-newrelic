from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import TimeRange


class NrqlRunRequest(BaseModel):
    account_id: int = Field(gt=0)
    nrql: str = Field(min_length=1, max_length=20_000)
    entity_guid: str | None = None
    time_range: TimeRange | None = None


class NrqlRunResponse(BaseModel):
    ok: bool = True
    account_id: int
    entity_guid: str | None = None
    nrql: str
    rows: list[dict[str, Any]]
    metadata: dict[str, Any] = Field(default_factory=dict)
    visualizations: list[dict[str, Any]] = Field(default_factory=list)
