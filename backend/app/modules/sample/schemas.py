"""Skema Pydantic untuk modul Sample & Time Study Tracker (FR-3, FR-4)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.sample.models import SampleStatus


# ---------------------------------------------------------------------------
# Sample (header)
# ---------------------------------------------------------------------------

class SampleCreate(BaseModel):
    """Membuat sample baru beserta versi pertama (v1 DRAFT)."""
    client_id: uuid.UUID = Field(..., description="ID Klien pemilik sample")
    sample_code: str = Field(..., min_length=2, max_length=100, description="Kode unik sample, misal: SMP-2026-001")
    article_name: str = Field(..., min_length=2, max_length=255, description="Nama artikel garmen, misal: Kaos Polos Navy")
    tech_pack_notes: str | None = Field(None, description="Catatan tech pack / spesifikasi versi pertama")


class SampleResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    sample_code: str
    article_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SampleVersion
# ---------------------------------------------------------------------------

class SampleVersionCreate(BaseModel):
    """Membuat versi revisi baru dari sample yang sudah ada."""
    tech_pack_notes: str | None = Field(None, description="Catatan perubahan spesifikasi revisi")


class SampleVersionApprove(BaseModel):
    """Payload approve versi sample (body kosong pun boleh)."""
    pass


class SampleVersionResponse(BaseModel):
    id: uuid.UUID
    sample_id: uuid.UUID
    version_number: int
    status: SampleStatus
    tech_pack_notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SampleWithVersionsResponse(SampleResponse):
    versions: list[SampleVersionResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SampleComponent (Time Study)
# ---------------------------------------------------------------------------

class SampleComponentCreate(BaseModel):
    """Menambahkan atau memperbarui komponen garmen beserta hasil stopwatch time study."""
    component_name: str = Field(..., min_length=1, max_length=255, description="Nama komponen, misal: Badan Depan, Kerah, Lengan")
    material_usage_est: float = Field(default=0.0, ge=0.0, description="Estimasi penggunaan bahan (meter/yard)")
    time_study_seconds: float = Field(default=0.0, ge=0.0, description="Hasil stopwatch time study dalam detik")


class SampleComponentResponse(BaseModel):
    id: uuid.UUID
    sample_version_id: uuid.UUID
    component_name: str
    material_usage_est: float
    time_study_seconds: float

    model_config = ConfigDict(from_attributes=True)


class SampleVersionDetailResponse(SampleVersionResponse):
    """Versi sample lengkap dengan semua komponen time study."""
    components: list[SampleComponentResponse] = []
    total_time_seconds: float = 0.0
    total_material_est: float = 0.0

    model_config = ConfigDict(from_attributes=True)
