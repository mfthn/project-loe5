"""Pengaturan aplikasi yang dibaca dari environment variable atau file .env."""
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Nilai default yang hanya boleh dipakai di development
_DEV_SECRET = "dev-only-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "project-loe5 API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://loe:loe_dev@localhost:5433/project_loe5"

    auth_secret: str = _DEV_SECRET
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ]

    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bedrock_model_id: str = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

    # RAG (endpoint /api/v1/ai/ask). Dokumen sumber dibaca dari S3.
    s3_bucket: str = ""
    s3_document_key: str = "sop.md"
    s3_region: str = "us-east-1"

    # Embedding: Amazon Titan Text Embeddings v2
    embedding_region: str = "us-east-1"
    embedding_model_id: str = "amazon.titan-embed-text-v2:0"
    embedding_dimensions: int = 1024

    # LLM: Amazon Nova Lite
    llm_region: str = "ap-southeast-1"
    llm_model_id: str = "amazon.nova-lite-v1:0"
    llm_max_tokens: int = 800
    llm_temperature: float = 0.2

    # Chunking dan retrieval
    chunk_size: int = 800
    chunk_overlap: int = 100
    top_k: int = 6
    similarity_threshold: float = 0.15

    @model_validator(mode="before")
    @classmethod
    def _fallback_env_aliases(cls, data: dict) -> dict:
        if isinstance(data, dict):
            if not data.get("s3_bucket") and data.get("aws_bucket"):
                data["s3_bucket"] = data["aws_bucket"]
            if (not data.get("s3_region") or data.get("s3_region") == "us-east-1") and data.get("rag_s3_region"):
                data["s3_region"] = data["rag_s3_region"]
            elif (not data.get("s3_region") or data.get("s3_region") == "us-east-1") and data.get("aws_region"):
                data["s3_region"] = data["aws_region"]
            if not data.get("chunk_size") and data.get("rag_chunk_size"):
                data["chunk_size"] = data["rag_chunk_size"]
            if not data.get("chunk_overlap") and data.get("rag_chunk_overlap"):
                data["chunk_overlap"] = data["rag_chunk_overlap"]
            if not data.get("top_k") and data.get("rag_top_k"):
                data["top_k"] = data["rag_top_k"]
            if not data.get("similarity_threshold") and data.get("rag_min_score"):
                data["similarity_threshold"] = data["rag_min_score"]
        return data

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+psycopg://", 1)
            elif v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+psycopg://", 1)
            if "?schema=" in v:
                v = v.split("?schema=")[0]
            elif "&schema=" in v:
                v = v.replace("&schema=", "&").rstrip("&")
        return v

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
