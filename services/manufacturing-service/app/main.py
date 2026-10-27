"""FastAPI Manufacturing Core Service (Sample, Gudang, Produksi, QC, Portal Klien)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.sample.router import router as sample_router
from app.modules.gudang.router import router as gudang_router
from app.modules.produksi.router import router as produksi_router
from app.modules.qc.router import router as qc_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="project-loe5 Manufacturing Service",
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

    # Register routers under /api/v1
    app.include_router(sample_router, prefix="/api/v1")
    app.include_router(gudang_router, prefix="/api/v1")
    app.include_router(produksi_router, prefix="/api/v1")
    app.include_router(qc_router, prefix="/api/v1")

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": "manufacturing-service"}

    return app


app = create_app()
