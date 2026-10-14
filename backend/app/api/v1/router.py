from fastapi import APIRouter

from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.gudang.router import router as gudang_router
from app.modules.sample.router import router as sample_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(gudang_router)
api_router.include_router(ai_router)
api_router.include_router(sample_router)
