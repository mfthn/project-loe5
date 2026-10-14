"""Pengaturan aplikasi yang dibaca dari environment variable atau file .env."""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Nilai default yang hanya boleh dipakai di development
_DEV_SECRET = "dev-only-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "project-loe5 API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://loe:loe_dev@localhost:5433/project_loe5"

    auth_secret: str = _DEV_SECRET
    cors_origins: list[str] = ["http://localhost:3000"]

    aws_region: str = "us-east-1"
    bedrock_model_id: str = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

    @model_validator(mode="after")
    def _guard_production_secrets(self) -> "Settings":
        # Mencegah server produksi berjalan dengan secret bawaan (temuan T9)
        if self.environment == "production":
            if self.auth_secret == _DEV_SECRET or len(self.auth_secret) < 32:
                raise ValueError("AUTH_SECRET wajib diisi (minimal 32 karakter) di environment production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
