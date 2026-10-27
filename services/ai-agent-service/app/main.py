"""FastAPI AI Agent Service (Chatbot Calon Klien & Owner Tracker RAG)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.ai.router import router as ai_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="project-loe5 AI Agent Service",
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://project-loe5.vercel.app",
        ] + (settings.cors_origins if isinstance(settings.cors_origins, list) else []),
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+|.*\.vercel\.app)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Route prefix /api/v1
    app.include_router(ai_router, prefix="/api/v1")

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "ai-agent-service",
            "provider": settings.llm_provider,
        }

    return app


app = create_app()
