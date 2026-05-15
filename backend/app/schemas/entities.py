from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EntityTag(BaseModel):
    key: str
    values: list[str] = Field(default_factory=list)


class EntitySummary(BaseModel):
    guid: str
    account_id: int | None = None
    name: str
    type: str | None = None
    domain: str | None = None
    language: str | None = None
    alert_severity: str | None = None
    health_status: str | None = None
    permalink: str | None = None
    tags: list[EntityTag] = Field(default_factory=list)
    reporting: bool | None = None
    transaction_event_type: str | None = None
    transaction_name_attribute: str | None = None
    data_sources: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class EntityListResponse(BaseModel):
    ok: bool = True
    entities: list[EntitySummary]
    next_cursor: str | None = None


class EntityDetailResponse(BaseModel):
    ok: bool = True
    entity: EntitySummary
