"""Skema Pydantic untuk modul Finance (PO bahan & Invoice klien)."""
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.finance.models import InvoiceStatus, POStatus


class POLineCreate(BaseModel):
    inventory_item_id: uuid.UUID
    qty_ordered: float = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)


class POCreate(BaseModel):
    po_number: str = Field(..., min_length=2, max_length=100)
    order_id: uuid.UUID
    supplier_name: str = Field(..., min_length=2, max_length=255)
    notes: str | None = None
    lines: list[POLineCreate] = Field(..., min_length=1)


class POReview(BaseModel):
    approve: bool
    notes: str | None = None


class POUpdate(BaseModel):
    """Finance melengkapi PO DRAFT sebelum review."""
    supplier_name: str | None = Field(None, min_length=2, max_length=255)
    line_prices: dict[str, float] | None = Field(
        None, description="Map inventory_item_id → harga satuan"
    )


class POPaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    notes: str | None = None


class POPaymentResponse(BaseModel):
    po_id: uuid.UUID
    po_number: str
    total_amount: float
    total_paid: float
    remaining: float
    lunas: bool


class POLineResponse(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    sequence_order: int
    qty_ordered: float
    qty_received: float
    unit_price: Decimal

    model_config = ConfigDict(from_attributes=True)


class POResponse(BaseModel):
    id: uuid.UUID
    po_number: str
    client_id: uuid.UUID
    order_id: uuid.UUID
    supplier_name: str
    status: POStatus
    total_amount: Decimal
    requested_by_user_id: uuid.UUID | None
    reviewed_by_user_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    reviewed_at: datetime | None
    lines: list[POLineResponse] = []

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(BaseModel):
    invoice_number: str = Field(..., min_length=2, max_length=100)
    order_id: uuid.UUID
    # Opsional: jika diisi, pakai nilai ini; jika kosong, otomatis
    # agreed_price × target_quantity dari versi sample OWNER_APPROVED.
    amount_total: Decimal | None = Field(None, gt=0)
    notes: str | None = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    client_id: uuid.UUID
    order_id: uuid.UUID
    amount_total: Decimal
    amount_paid: Decimal
    status: InvoiceStatus
    issued_by_user_id: uuid.UUID | None
    approved_by_user_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    approved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class InvoicePaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    notes: str | None = None


class InvoicePaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    recorded_by_user_id: uuid.UUID | None
    notes: str | None
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HPPApplyRequest(BaseModel):
    """Terapkan biaya bahan terealisasi ke HPP. Revenue/overhead opsional:
    pakai nilai tersimpan jika sudah ada, wajib diisi jika HPP belum pernah dibuat."""
    contract_revenue: Decimal | None = Field(None, ge=0)
    overhead_cost: Decimal | None = Field(None, ge=0)


class HPPRealizedResponse(BaseModel):
    order_id: uuid.UUID
    order_number: str
    realized_material_cost: float
    po_count: int
    breakdown: list[dict]


class ProductionNeedResponse(BaseModel):
    request_id: uuid.UUID
    order_id: uuid.UUID
    order_number: str
    order_status: str
    inventory_item_id: uuid.UUID
    material_code: str
    material_name: str
    qty_requested: float
    qty_fulfilled: float
    current_stock: float
    request_status: str
    need_status: str
