"""Pengujian aturan keamanan konfigurasi."""
import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_rejects_default_secret():
    with pytest.raises(ValidationError):
        Settings(environment="production", auth_secret="dev-only-secret")


def test_production_rejects_short_secret():
    with pytest.raises(ValidationError):
        Settings(environment="production", auth_secret="pendek")


def test_production_accepts_strong_secret():
    settings = Settings(environment="production", auth_secret="x" * 40)
    assert settings.environment == "production"


def test_development_allows_default_secret():
    # _env_file=None agar tes tidak terpengaruh isi .env lokal
    settings = Settings(_env_file=None, environment="development")
    assert settings.auth_secret == "dev-only-secret"
