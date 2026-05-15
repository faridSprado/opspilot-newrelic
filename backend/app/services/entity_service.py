from __future__ import annotations

from typing import Any

from app.schemas.entities import EntitySummary, EntityTag


def tag_value(tags: list[dict[str, Any]], *names: str) -> str | None:
    wanted = {name.lower() for name in names}
    for tag in tags:
        if str(tag.get("key", "")).lower() in wanted:
            values = tag.get("values") or []
            return str(values[0]) if values else None
    return None


def normalize_entity(entity: dict[str, Any]) -> EntitySummary:
    tags_raw = entity.get("tags") or []
    tags = [EntityTag(key=str(tag.get("key", "")), values=[str(v) for v in tag.get("values") or []]) for tag in tags_raw]
    return EntitySummary(
        guid=str(entity.get("guid") or ""),
        account_id=int(entity["accountId"]) if entity.get("accountId") else None,
        name=str(entity.get("name") or "Unnamed entity"),
        type=entity.get("type"),
        domain=entity.get("domain"),
        language=entity.get("language") or tag_value(tags_raw, "language", "agent.language", "newrelic.language"),
        alert_severity=entity.get("alertSeverity"),
        health_status=entity.get("healthStatus") or entity.get("alertSeverity"),
        permalink=entity.get("permalink"),
        tags=tags,
        reporting=entity.get("reporting"),
        transaction_event_type=entity.get("transactionEventType") or tag_value(tags_raw, "transaction.eventType", "eventType"),
        transaction_name_attribute=entity.get("transactionNameAttribute") or "name",
        data_sources=entity.get("dataSources") or [],
        raw=entity,
    )
