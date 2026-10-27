"""Pengaturan aplikasi auth-service."""
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "project-loe5 Auth Service"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://loe:loe_dev@localhost:5433/project_loe5"
    auth_secret: str = _DEV_SECRET
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ]

    @field_validator("auth_secret")
    @classmethod
    def _validate_auth_secret(cls, v: str, info) -> str:
        env = info.data.get("environment", "development")
        if env == "production" and v == _DEV_SECRET:
            raise ValueError(
                "AUTH_SECRET wajib disetel ke string acak panjang di lingkungan production."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
