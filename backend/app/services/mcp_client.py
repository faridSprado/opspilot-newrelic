from __future__ import annotations

from typing import Any

import httpx

from app.security import redact_secrets


class MCPClient:
    """Small HTTP client for an optional New Relic MCP server.

    The app works without MCP by using NerdGraph directly. When `MCP_NEW_RELIC_URL` is set,
    this client can invoke MCP tools from backend-only code paths.
    """

    def __init__(self, base_url: str | None, timeout_seconds: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/") if base_url else None
        self.timeout_seconds = timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "error": {"code": "MCP_NOT_CONFIGURED", "message": "MCP server is not configured."}}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(f"{self.base_url}/tools/{name}", json={"arguments": redact_secrets(arguments)})
            response.raise_for_status()
            return response.json()
