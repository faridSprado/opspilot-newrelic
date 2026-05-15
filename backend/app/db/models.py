from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class Workspace:
    id: str
    name: str
    created_at: datetime


@dataclass(slots=True)
class CredentialProfile:
    id: str
    workspace_id: str
    label: str
    account_ids: list[int]
    region: str
    encrypted_api_key: str
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class Entity:
    guid: str
    account_id: int | None
    name: str
    type: str | None = None
    domain: str | None = None
    language: str | None = None
    alert_severity: str | None = None
    permalink: str | None = None
    tags: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class ChatSession:
    id: str
    workspace_id: str
    title: str
    selected_entity_guid: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class QueryRun:
    id: str
    session_id: str | None
    account_id: int
    entity_guid: str | None
    nrql: str
    result_json: dict[str, Any]
    chart_spec_json: list[dict[str, Any]]
