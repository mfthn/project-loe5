"""Skema Pydantic untuk modul Quality Control & Pool Bonus QC (FR-9, FR-10.3)."""
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.qc.models import QCStatus


# ---------------------------------------------------------------------------
# QC Inspection
# ---------------------------------------------------------------------------

class QCInspectionCreate(BaseModel):
    """Input inspeksi QC oleh QC Inspector."""
    order_id: uuid.UUID = Field(..., description="ID Order yang diinspeksi")
    production_output_id: uuid.UUID | None = Field(
        None, description="ID log output 30 menit terkait (opsional)"
    )
    status: QCStatus = Field(..., description="Hasil inspeksi: LOLOS, REPAIR, atau DEFECT")
    qty_inspected: int = Field(..., gt=0, description="Jumlah pcs yang diinspeksi (harus > 0)")
    repair_count: int = Field(default=0, ge=0, description="Jumlah kali barang ini telah diperbaiki")
    defect_category: str | None = Field(
        None, max_length=255,
        description="Kategori defect jika status DEFECT/REPAIR, misal: Jahitan Loncat, Kancing Lepas"
    )
    notes: str | None = Field(None, description="Catatan tambahan inspector")


class QCInspectionResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    production_output_id: uuid.UUID | None
    inspector_user_id: uuid.UUID
    status: QCStatus
    qty_inspected: int
    repair_count: int
    escalated_to_sample: bool
    defect_category: str | None
    notes: str | None
    inspected_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# QC Summary per order
# ---------------------------------------------------------------------------

class QCSummaryResponse(BaseModel):
    """Ringkasan hasil QC untuk satu order."""
    order_id: uuid.UUID
    total_inspected: int
    qty_lolos: int
    qty_repair: int
    qty_defect: int
    lolos_pct: float
    defect_pct: float


# ---------------------------------------------------------------------------
# Pool Bonus QC (Skenario 3 - FR-10.3)
# ---------------------------------------------------------------------------

class QCBonusConfig(BaseModel):
    """Konfigurasi pembagian pool bonus QC per order."""
    bonus_rate_per_pcs: Decimal = Field(
        ..., gt=0,
        description="Rate bonus per pcs yang lolos QC (Rp), misal: 500.00"
    )


class BonusRecipient(BaseModel):
    """Detail penerima bonus QC."""
    user_id: uuid.UUID
    username: str
    name: str
    role: str
    bonus_amount: Decimal


class QCBonusPoolResponse(BaseModel):
    """Hasil kalkulasi dan pembagian pool bonus QC 3-arah (Skenario 3 FR-10.3)."""
    order_id: uuid.UUID
    qty_lolos: int
    bonus_rate_per_pcs: Decimal
    total_pool: Decimal
    recipient_count: int
    bonus_per_recipient: Decimal
    recipients: list[BonusRecipient]
