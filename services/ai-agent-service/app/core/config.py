"""Konfigurasi untuk ai-agent-service."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "lukla_operations_engine_super_secret_auth_key_2026_dev_secure"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "project-loe5 AI Agent Service"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://loe:loe_dev@localhost:5433/project_loe5"
    auth_secret: str = _DEV_SECRET
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ]

    # LLM Provider: 'free' (default offline heuristic), 'gemini', atau 'bedrock'
    llm_provider: str = "free"
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # Knowledge Base Path
    docs_local_path: str = "data/docs"

    # Chunking & Retrieval
    chunk_size: int = 800
    chunk_overlap: int = 100
    top_k: int = 6
    similarity_threshold: float = 0.05

    # Fallback AWS Settings bila suatu saat diaktifkan kembali
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    embedding_model_id: str = "amazon.titan-embed-text-v2:0"
    embedding_dimensions: int = 1024
    llm_model_id: str = "amazon.nova-lite-v1:0"
    llm_max_tokens: int = 800
    llm_temperature: float = 0.2


@lru_cache
def get_settings() -> Settings:
    return Settings()
