from fastapi import APIRouter

from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.gudang.router import router as gudang_router
from app.modules.payroll.router import router as payroll_router
from app.modules.produksi.router import router as produksi_router
from app.modules.qc.router import router as qc_router
from app.modules.sample.router import router as sample_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(gudang_router)
api_router.include_router(ai_router)
api_router.include_router(sample_router)
api_router.include_router(produksi_router)
api_router.include_router(qc_router)
api_router.include_router(payroll_router)
