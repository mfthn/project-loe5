"""FastAPI Finance & Payroll Service Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.finance.router import router as finance_router
from app.modules.payroll.router import router as payroll_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="project-loe5 Finance Service",
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Route prefix /api/v1
    app.include_router(finance_router, prefix="/api/v1")
    app.include_router(payroll_router, prefix="/api/v1")

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": "finance-service"}

    return app


app = create_app()
