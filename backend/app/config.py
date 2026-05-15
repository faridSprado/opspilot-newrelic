from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Load .env from stable, absolute locations instead of depending on the
# current working directory. This makes Gemini/OpenAI work whether the backend
# is launched from the project root, from backend/, from VS Code, or by start.bat.
ENV_FILES = (
    str(PROJECT_ROOT / ".env"),
    str(BACKEND_DIR / ".env"),
)


class Settings(BaseSettings):
    app_env: Literal["development", "test", "production"] = "development"
    app_secret_key: str = "dev-change-me-use-a-32-byte-secret"
    database_url: str = "sqlite:///./opspilot.db"
    redis_url: str | None = None

    new_relic_region: Literal["US", "EU"] = "US"
    new_relic_api_key: str | None = None
    new_relic_account_id: int | None = None

    llm_provider: Literal["none", "openai", "anthropic", "gemini"] = "none"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY"),
    )
    gemini_model: str = "gemini-2.5-flash"
    mcp_new_relic_url: str | None = None

    # Keep this as a raw string so pydantic-settings does not try to JSON-decode
    # comma-separated values from .env before our validator can run.
    cors_origins: str = "http://localhost:3000,http://localhost:8080"
    log_level: str = "INFO"
    request_timeout_seconds: float = 20.0
    nrql_timeout_seconds: float = 30.0
    max_nrql_limit: int = 5000
    rate_limit_per_minute: int = 90
    enable_mock_data: bool = False

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @field_validator("app_env", "llm_provider", mode="before")
    @classmethod
    def normalize_lowercase_values(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("new_relic_region", mode="before")
    @classmethod
    def normalize_region(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("openai_api_key", "anthropic_api_key", "gemini_api_key", mode="before")
    @classmethod
    def normalize_optional_secret(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip().strip('"').strip("'")
            return value or None
        return value

    @field_validator("gemini_model", "openai_model", "anthropic_model", mode="before")
    @classmethod
    def normalize_model_name(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip().strip('"').strip("'")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: str | list[str]) -> str:
        if isinstance(value, list):
            return ",".join(str(item).strip() for item in value if str(item).strip())
        if isinstance(value, str):
            return value.strip().strip("'").strip('"')
        return str(value)

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if not raw:
            return []

        # Support both formats in .env:
        # CORS_ORIGINS=http://localhost:3000,http://localhost:8080
        # CORS_ORIGINS=["http://localhost:3000", "http://localhost:8080"]
        if raw.startswith("["):
            try:
                decoded = json.loads(raw)
            except json.JSONDecodeError:
                decoded = None
            if isinstance(decoded, list):
                return [str(item).strip() for item in decoded if str(item).strip()]

        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def nerdgraph_endpoint(self) -> str:
        return "https://api.eu.newrelic.com/graphql" if self.new_relic_region == "EU" else "https://api.newrelic.com/graphql"

    @property
    def env_files_checked(self) -> list[str]:
        return [env_file for env_file in ENV_FILES if Path(env_file).exists()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Let real environment variables override .env, but keep .env loading stable.
    # This is useful for Docker/CI and does not expose secrets.
    _ = os.environ
    return Settings()
