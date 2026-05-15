from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import AppError, app_error_handler, unhandled_error_handler
from app.logging_config import configure_logging
from app.routes import accounts, charts, chat, credentials, entities, health, investigations, nrql
from app.security import InMemoryRateLimiter, request_ip

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)
rate_limiter = InMemoryRateLimiter(settings.rate_limit_per_minute)

app = FastAPI(
    title="OpsPilot for New Relic API",
    description="Secure New Relic Copilot backend with NerdGraph, NRQL, visualization contracts and safe agent tooling.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Credential-Profile-Id"],
)


@app.middleware("http")
async def security_headers_and_rate_limit(request: Request, call_next):
    if not rate_limiter.allow(request_ip(request)):
        return JSONResponse(status_code=429, content={"ok": False, "error": {"code": "RATE_LIMITED", "message": "Demasiadas solicitudes. Espera un momento y reintenta."}})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' http://localhost:8000 http://127.0.0.1:8000; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    return response


app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health.router)
app.include_router(credentials.router)
app.include_router(accounts.router)
app.include_router(entities.router)
app.include_router(nrql.router)
app.include_router(charts.router)
app.include_router(chat.router)
app.include_router(investigations.router)


@app.on_event("startup")
async def startup() -> None:
    logger.info("OpsPilot backend started", extra={"env": settings.app_env})
