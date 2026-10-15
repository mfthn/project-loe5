"""Skema Pydantic untuk modul Produksi, Order Massal, dan Terminal 30 Menit (FR-7, FR-8, FR-9)."""
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.produksi.models import MaklonScheme, OrderStatus


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

class OrderComponentCreate(BaseModel):
    component_name: str = Field(..., min_length=1, max_length=255, description="Nama komponen, misal: Badan Depan")
    sequence_order: int = Field(default=1, ge=1, description="Urutan pengerjaan komponen")
    cutting_rate_per_pcs: Decimal = Field(default=Decimal("0.00"), ge=0, description="Tarif cutting per pcs (Rp)")
    sewing_rate_per_pcs: Decimal = Field(default=Decimal("0.00"), ge=0, description="Tarif sewing per pcs (Rp)")


class OrderCreate(BaseModel):
    """Membuat Order Produksi Massal baru."""
    client_id: uuid.UUID = Field(..., description="ID Klien pemilik order")
    order_number: str = Field(..., min_length=2, max_length=100, description="Nomor order unik, misal: ORD-2026-001")
    scheme: MaklonScheme = Field(..., description="Skema maklon: CMT, SEMI_CMT, atau FULL_PACKAGE")
    target_quantity: int = Field(..., gt=0, description="Target jumlah pcs yang diproduksi")
    sample_version_id: uuid.UUID | None = Field(None, description="ID Versi sample APPROVED (opsional)")
    start_date: datetime | None = Field(None, description="Tanggal mulai produksi")
    deadline: datetime | None = Field(None, description="Batas waktu selesai")
    components: list[OrderComponentCreate] = Field(
        default_factory=list,
        description="Daftar komponen garmen beserta rate card upah borongan",
    )


class OrderFromSampleCreate(BaseModel):
    """Konversi versi sample APPROVED menjadi Order Produksi Massal (FR-4.1)."""
    order_number: str = Field(..., min_length=2, max_length=100, description="Nomor order unik")
    scheme: MaklonScheme = Field(..., description="Skema maklon")
    target_quantity: int = Field(..., gt=0, description="Target jumlah pcs")
    start_date: datetime | None = Field(None, description="Tanggal mulai produksi")
    deadline: datetime | None = Field(None, description="Batas waktu selesai")
    cutting_rate_per_pcs: Decimal = Field(default=Decimal("0.00"), ge=0, description="Tarif cutting per pcs")
    sewing_rate_per_pcs: Decimal = Field(default=Decimal("0.00"), ge=0, description="Tarif sewing per pcs")


class OrderStatusUpdate(BaseModel):
    """Pembaruan status order oleh Mandor/Owner."""
    status: OrderStatus = Field(..., description="Status baru order")


class RateCardResponse(BaseModel):
    id: uuid.UUID
    order_component_id: uuid.UUID
    cutting_rate_per_pcs: Decimal
    sewing_rate_per_pcs: Decimal
    effective_date: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderComponentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    component_name: str
    sequence_order: int
    rate_card: RateCardResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    sample_version_id: uuid.UUID | None
    order_number: str
    scheme: MaklonScheme
    target_quantity: int
    status: OrderStatus
    start_date: datetime | None
    deadline: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderDetailResponse(OrderResponse):
    """Order lengkap dengan daftar komponen dan rate card."""
    components: list[OrderComponentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# ProductionOutput (Terminal 30 Menit)
# ---------------------------------------------------------------------------

class ProductionOutputCreate(BaseModel):
    """Input output produksi dari terminal tablet lantai pabrik setiap 30 menit."""
    order_id: uuid.UUID = Field(..., description="ID Order yang sedang dikerjakan")
    order_component_id: uuid.UUID = Field(..., description="ID Komponen yang dicatat outputnya")
    line_number: int = Field(..., ge=1, description="Nomor line jahit (1–10)")
    qty_completed: int = Field(..., gt=0, description="Jumlah pcs selesai di interval ini")
    time_window: datetime = Field(..., description="Timestamp awal interval 30 menit (contoh: 08:00, 08:30, 09:00)")


class ProductionOutputVerify(BaseModel):
    """Verifikasi output 30 menit oleh Mandor."""
    is_verified: bool = Field(default=True)


class ProductionOutputResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    order_component_id: uuid.UUID
    operator_user_id: uuid.UUID
    verified_by_user_id: uuid.UUID | None
    line_number: int
    qty_completed: int
    is_verified: bool
    time_window: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderOutputSummary(BaseModel):
    """Ringkasan total output per order."""
    order_id: uuid.UUID
    order_number: str
    target_quantity: int
    total_completed: int
    verified_completed: int
    completion_pct: float


class WorkerDashboardOrderResponse(BaseModel):
    order_id: uuid.UUID
    order_number: str
    status: OrderStatus
    target_quantity: int
    start_date: datetime | None
    deadline: datetime | None
    own_output_qty: int
    own_verified_qty: int
    qc_passed_qty: int
    qc_repair_qty: int
    qc_defect_qty: int


class WorkerDashboardResponse(BaseModel):
    total_output_qty: int
    verified_output_qty: int
    qc_passed_qty: int
    qc_repair_qty: int
    qc_defect_qty: int
    unattributed_qc_inspections: int
    orders: list[WorkerDashboardOrderResponse]
