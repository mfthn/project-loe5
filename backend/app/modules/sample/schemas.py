"""Skema Pydantic untuk modul Sample & Time Study Tracker (FR-3, FR-4)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.sample.models import SampleStatus


# ---------------------------------------------------------------------------
# Sample (header)
# ---------------------------------------------------------------------------

class SampleCreate(BaseModel):
    """Membuat sample baru beserta versi pertama (v1 DRAFT). Kode digenerate otomatis."""
    client_id: uuid.UUID = Field(..., description="ID Klien pemilik sample")
    sample_code: str | None = Field(
        None, min_length=2, max_length=100,
        description="Opsional; jika kosong digenerate SMP-{KATEGORI}-{SEQ}",
    )
    article_name: str = Field(..., min_length=2, max_length=255, description="Nama artikel garmen, misal: Kaos Polos Navy")
    category: str = Field(default="UMUM", min_length=2, max_length=50, description="Kategori barang: TAS, HOODIE, JAKET, atau lainnya")
    tech_pack_notes: str | None = Field(None, description="Catatan tech pack / spesifikasi versi pertama")


class SampleResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    sample_code: str
    article_name: str
    category: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SampleVersion
# ---------------------------------------------------------------------------

class SampleVersionCreate(BaseModel):
    """Membuat versi revisi baru dari sample yang sudah ada."""
    tech_pack_notes: str | None = Field(None, description="Catatan perubahan spesifikasi revisi / design pesanan")
    order_id: uuid.UUID | None = Field(
        None, description="Tautkan revisi ke pesanan tertentu (opsional)"
    )


class SampleVersionApprove(BaseModel):
    """Payload approve versi sample (body kosong pun boleh)."""
    pass


class OwnerApproveRequest(BaseModel):
    """Tahap 2: owner menyetujui produk + harga kesepakatan."""
    agreed_price: float = Field(..., gt=0, description="Harga deal per pcs yang disetujui owner")
    currency: str = Field(default="IDR", min_length=3, max_length=3)
    costing_notes: str | None = Field(None, description="Catatan costing / skema maklon")


class OwnerRejectRequest(BaseModel):
    reason: str | None = Field(None, description="Alasan penolakan owner")


class SampleVersionResponse(BaseModel):
    id: uuid.UUID
    sample_id: uuid.UUID
    version_number: int
    status: SampleStatus
    order_id: uuid.UUID | None = None
    design_image_key: str | None = None
    design_image_url: str | None = Field(None, description="URL presigned sementara bila ada gambar")
    tech_pack_notes: str | None
    agreed_price: float | None = None
    currency: str = "IDR"
    costing_notes: str | None = None
    sample_approved_by: uuid.UUID | None = None
    sample_approved_at: datetime | None = None
    owner_approved_by: uuid.UUID | None = None
    owner_approved_at: datetime | None = None
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
