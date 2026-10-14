"""Menggabungkan seluruh router API v1. Router modul fitur ditambahkan di sini saat modulnya dibangun."""
from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
