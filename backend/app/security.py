from __future__ import annotations

import base64
import hashlib
import logging
import re
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Request

SENSITIVE_KEY_RE = re.compile(r"(api[_-]?key|token|secret|password|credential|authorization|x-api-key)", re.I)
BLOCKED_NRQL_RE = re.compile(r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|mutation)\b", re.I)
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def mask_secret(value: str | None, visible: int = 4) -> str | None:
    if value is None:
        return None
    if len(value) <= visible * 2:
        return "*" * len(value)
    return f"{value[:visible]}{'*' * 12}{value[-visible:]}"


def redact_secrets(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            if SENSITIVE_KEY_RE.search(str(key)):
                redacted[key] = mask_secret(str(item)) if item is not None else None
            else:
                redacted[key] = redact_secrets(item)
        return redacted
    if isinstance(value, list):
        return [redact_secrets(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_secrets(item) for item in value)
    return value


class SecretRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, dict):
            record.args = redact_secrets(record.args)
        elif isinstance(record.args, tuple):
            record.args = tuple(redact_secrets(arg) for arg in record.args)
        if isinstance(record.msg, str):
            record.msg = SENSITIVE_KEY_RE.sub(lambda m: m.group(1).split("_")[0] + "_REDACTED", record.msg)
        return True


def derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


@dataclass
class CredentialCipher:
    secret: str

    def __post_init__(self) -> None:
        self._fernet = Fernet(derive_fernet_key(self.secret))

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt credential with the configured APP_SECRET_KEY") from exc


def sanitize_user_text(text: str, max_length: int = 8000) -> str:
    cleaned = CONTROL_CHARS_RE.sub("", text).strip()
    return cleaned[:max_length]


def assert_safe_nrql(nrql: str) -> str:
    query = sanitize_user_text(nrql, max_length=20_000)
    normalized = query.strip().rstrip(";")
    if not normalized:
        raise ValueError("NRQL query is empty")
    if BLOCKED_NRQL_RE.search(normalized):
        raise ValueError("Only read-only NRQL queries are allowed")
    if not re.match(r"^\s*(SELECT|SHOW)\b", normalized, re.I):
        raise ValueError("NRQL must start with SELECT or SHOW")
    return normalized


def escape_nrql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


class InMemoryRateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60
        hits = self._hits[key]
        while hits and hits[0] < window_start:
            hits.popleft()
        if len(hits) >= self.requests_per_minute:
            return False
        hits.append(now)
        return True


def request_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
