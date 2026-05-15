from __future__ import annotations

import logging
from typing import Any, Literal

import httpx

from app.security import assert_safe_nrql, redact_secrets

logger = logging.getLogger(__name__)


class NewRelicClientError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502, details: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = redact_secrets(details)


class NewRelicClient:
    def __init__(self, api_key: str, region: Literal["US", "EU"] = "US", timeout_seconds: float = 20.0) -> None:
        self.api_key = api_key
        self.region = region
        self.timeout_seconds = timeout_seconds
        self.endpoint = "https://api.eu.newrelic.com/graphql" if region == "EU" else "https://api.newrelic.com/graphql"

    async def graphql(self, query: str, variables: dict[str, Any] | None = None, timeout_seconds: float | None = None) -> dict[str, Any]:
        headers = {"API-Key": self.api_key, "Content-Type": "application/json"}
        payload = {"query": query, "variables": variables or {}}
        timeout = httpx.Timeout(timeout_seconds or self.timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(self.endpoint, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            raise NewRelicClientError("NEW_RELIC_TIMEOUT", "New Relic tardó demasiado en responder.", 504) from exc
        except httpx.HTTPError as exc:
            raise NewRelicClientError("NEW_RELIC_NETWORK_ERROR", "No pude conectar con New Relic.", 502, {"error": str(exc)}) from exc

        if response.status_code in {401, 403}:
            raise NewRelicClientError(
                "NEW_RELIC_AUTH_ERROR",
                "Tu API Key no tiene acceso o fue rechazada por New Relic.",
                response.status_code,
            )
        if response.status_code >= 400:
            raise NewRelicClientError(
                "NEW_RELIC_HTTP_ERROR",
                "New Relic respondió con un error HTTP.",
                response.status_code,
                {"status_code": response.status_code, "body": response.text[:500]},
            )
        try:
            data = response.json()
        except ValueError as exc:
            raise NewRelicClientError("NEW_RELIC_BAD_JSON", "New Relic devolvió una respuesta no JSON.", 502) from exc
        if data.get("errors"):
            raise NewRelicClientError(
                "NEW_RELIC_GRAPHQL_ERROR",
                "New Relic devolvió errores de GraphQL.",
                502,
                {"errors": data.get("errors")},
            )
        return data.get("data", {})

    async def validate_credentials(self, expected_account_ids: list[int] | None = None) -> dict[str, Any]:
        query = """
        query ValidateNewRelicCredentials {
          actor {
            user { name email }
            accounts { id name }
          }
        }
        """
        data = await self.graphql(query)
        accounts = data.get("actor", {}).get("accounts", []) or []
        expected = set(expected_account_ids or [])
        found = {int(account["id"]) for account in accounts if account.get("id") is not None}
        missing = sorted(expected - found)
        if missing:
            raise NewRelicClientError(
                "NEW_RELIC_ACCOUNT_FORBIDDEN",
                "La API Key es válida, pero no tiene acceso a una o más cuentas indicadas.",
                403,
                {"missing_account_ids": missing},
            )
        return {"user": data.get("actor", {}).get("user"), "accounts": accounts}

    async def list_accounts(self) -> list[dict[str, Any]]:
        query = """
        query ListAccounts {
          actor { accounts { id name } }
        }
        """
        data = await self.graphql(query)
        return data.get("actor", {}).get("accounts", []) or []

    async def entity_search(self, query_text: str, cursor: str | None = None, limit: int = 100) -> dict[str, Any]:
        query = """
        query SearchEntities($query: String!, $cursor: String) {
          actor {
            entitySearch(query: $query) {
              count
              results(cursor: $cursor) {
                nextCursor
                entities {
                  guid
                  accountId
                  name
                  type
                  domain
                  permalink
                  alertSeverity
                  reporting
                  tags { key values }
                }
              }
            }
          }
        }
        """
        variables = {"query": query_text, "cursor": cursor}
        data = await self.graphql(query, variables)
        search = data.get("actor", {}).get("entitySearch", {})
        results = search.get("results", {}) or {}
        entities = results.get("entities", []) or []
        return {"count": search.get("count", len(entities)), "entities": entities[:limit], "nextCursor": results.get("nextCursor")}

    async def list_apm_entities(self, account_ids: list[int] | None = None, cursor: str | None = None) -> dict[str, Any]:
        account_clause = ""
        if account_ids:
            joined = " OR ".join(f"accountId = {int(account_id)}" for account_id in account_ids)
            account_clause = f" AND ({joined})"
        query_text = f"domain = 'APM' AND type = 'APPLICATION'{account_clause}"
        entities: list[dict[str, Any]] = []
        next_cursor = cursor
        total_count = 0
        # NerdGraph pagina entitySearch. Recorremos varias páginas para que
        # cuentas con muchas APMs no queden truncadas en la primera respuesta.
        for _ in range(25):
            page = await self.entity_search(query_text, cursor=next_cursor, limit=200)
            total_count = int(page.get("count") or total_count or 0)
            entities.extend(page.get("entities", []) or [])
            next_cursor = page.get("nextCursor")
            if not next_cursor:
                break
        # Deduplicar por GUID manteniendo orden.
        seen: set[str] = set()
        unique_entities: list[dict[str, Any]] = []
        for entity in entities:
            guid = str(entity.get("guid") or "")
            if guid and guid not in seen:
                seen.add(guid)
                unique_entities.append(entity)
        return {"count": total_count or len(unique_entities), "entities": unique_entities, "nextCursor": next_cursor}

    async def get_entity(self, guid: str) -> dict[str, Any] | None:
        query = """
        query GetEntity($guid: EntityGuid!) {
          actor {
            entity(guid: $guid) {
              guid
              accountId
              name
              type
              domain
              permalink
              alertSeverity
              reporting
              tags { key values }
            }
          }
        }
        """
        data = await self.graphql(query, {"guid": guid})
        return data.get("actor", {}).get("entity")


    async def detect_apm_data_sources(self, account_id: int, entity_guid: str, since: str = "24 hours ago") -> dict[str, Any]:
        """Detecta qué eventos NRDB tienen datos para una APM.

        New Relic no obliga a que todas las APM expongan exactamente los mismos
        eventos/atributos. Para no mostrar una interfaz equivocada, probamos las
        fuentes más útiles y devolvemos conteos seguros, sin datos sensibles.
        """
        candidates = [
            ("Transaction", "name"),
            ("TransactionError", "error.class"),
            ("Span", "name"),
            ("Metric", "metricName"),
            ("Log", "message"),
        ]
        data_sources: list[dict[str, Any]] = []
        for event_type, name_attribute in candidates:
            nrql = f"SELECT count(*) AS 'count' FROM {event_type} WHERE entity.guid = '{entity_guid.replace(chr(39), '')}' SINCE {since}"
            try:
                result = await self.run_nrql(account_id, nrql, timeout_seconds=8)
                rows = result.get("results", []) or []
                count = 0
                if rows and isinstance(rows[0], dict):
                    raw = rows[0].get("count") or rows[0].get("Count") or rows[0].get("count(*)") or 0
                    if isinstance(raw, (int, float)):
                        count = int(raw)
                if count > 0:
                    data_sources.append({"event_type": event_type, "name_attribute": name_attribute, "count": count})
            except NewRelicClientError:
                continue
        primary = next((source for source in data_sources if source["event_type"] == "Transaction"), data_sources[0] if data_sources else None)
        return {
            "primary_event_type": primary["event_type"] if primary else "Transaction",
            "transaction_name_attribute": primary["name_attribute"] if primary else "name",
            "data_sources": data_sources,
            "time_basis": "UTC",
            "since": since,
        }

    async def run_nrql(self, account_id: int, nrql: str, timeout_seconds: float | None = None) -> dict[str, Any]:
        safe_nrql = assert_safe_nrql(nrql)
        query = """
        query RunNrql($accountId: Int!, $nrql: Nrql!) {
          actor {
            account(id: $accountId) {
              nrql(query: $nrql) {
                results
                metadata { eventTypes facets messages timeWindow { begin end } }
              }
            }
          }
        }
        """
        data = await self.graphql(query, {"accountId": int(account_id), "nrql": safe_nrql}, timeout_seconds=timeout_seconds)
        return data.get("actor", {}).get("account", {}).get("nrql", {}) or {"results": [], "metadata": {}}
