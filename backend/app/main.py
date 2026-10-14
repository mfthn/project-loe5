"""Titik masuk aplikasi FastAPI.

Jalankan dari folder backend: uvicorn app.main:app --reload
Dokumentasi interaktif: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
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
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # Origin harus disebut eksplisit karena frontend mengirim cookie (allow_credentials)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
