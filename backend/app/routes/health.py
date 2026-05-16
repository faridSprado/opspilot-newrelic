from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Response

from app.config import get_settings

router = APIRouter(tags=["health"])


def build_health_payload() -> dict:
    settings = get_settings()
    return {
        "ok": True,
        "service": "opspilot-newrelic-backend",
        "env": settings.app_env,
        "new_relic_region": settings.new_relic_region,
        "has_env_new_relic_key": bool(settings.new_relic_api_key),
        "llm_provider": settings.llm_provider,
        "has_gemini_key": bool(settings.gemini_api_key),
        "has_openai_key": bool(settings.openai_api_key),
        "cors_origins": settings.cors_origin_list,
        "env_files_checked": settings.env_files_checked,
        "time": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get("/api/health")
@router.get("/health")
async def health() -> dict:
    return build_health_payload()


@router.head("/api/health")
@router.head("/health")
async def health_head() -> Response:
    """Allow uptime monitors that validate availability with HEAD requests."""
    return Response(status_code=200)
