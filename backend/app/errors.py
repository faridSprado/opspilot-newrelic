from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.security import redact_secrets


class ApiError(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ApiErrorResponse(BaseModel):
    ok: bool = False
    error: ApiError


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = redact_secrets(details)


def api_error_response(error: AppError) -> JSONResponse:
    payload = ApiErrorResponse(error=ApiError(code=error.code, message=error.message, details=error.details))
    return JSONResponse(status_code=error.status_code, content=payload.model_dump())


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return api_error_response(exc)


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    payload = ApiErrorResponse(
        error=ApiError(
            code="INTERNAL_SERVER_ERROR",
            message="Ocurrió un error interno. Reintenta o revisa los logs seguros del backend.",
            details={"type": exc.__class__.__name__},
        )
    )
    return JSONResponse(status_code=500, content=payload.model_dump())
