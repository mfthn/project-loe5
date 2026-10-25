"""Titik masuk aplikasi FastAPI.

Jalankan dari folder backend: uvicorn app.main:app --reload
Dokumentasi interaktif: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.swagger import register_responsive_docs
# Registrasi seluruh model ORM agar metadata foreign key terhubung utuh
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.gudang import models as gudang_models  # noqa: F401
from app.modules.payroll import models as payroll_models  # noqa: F401
from app.modules.produksi import models as produksi_models  # noqa: F401
from app.modules.qc import models as qc_models  # noqa: F401
from app.modules.sample import models as sample_models  # noqa: F401


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None,  # diganti halaman /docs responsif via register_responsive_docs
        openapi_url="/openapi.json",
    )

    # Origin harus disebut eksplisit karena frontend mengirim cookie (allow_credentials).
    # Regex mencakup IP publik EC2 agar frontend di http://<IP>:3000 bisa memanggil API.
    # Mengizinkan akses dari lokal (untuk developer) dan semua subdomain Vercel (untuk production/preview)
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

    app.include_router(api_router, prefix="/api/v1")
    register_responsive_docs(app, title=f"{settings.app_name} - API Docs")

    @app.get("/health", tags=["system"], summary="Health Check")
    def health_check() -> dict[str, str]:
        """Health check endpoint untuk monitoring sistem dan service check."""
        return {"status": "ok"}

    return app


app = create_app()
