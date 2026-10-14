"""Endpoint pemeriksaan kesehatan. Dipakai frontend dan monitoring untuk memastikan API dan database hidup."""
from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: str  # "ok" atau "degraded"
    database: str  # "ok" atau "unavailable"


@router.get("", response_model=HealthResponse)
def health(response: Response, db: Session = Depends(get_db)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        return HealthResponse(status="ok", database="ok")
    except Exception:
        # API tetap menjawab, tetapi memberi tahu bahwa database tidak tersedia
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="degraded", database="unavailable")
