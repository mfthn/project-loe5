"""Skema Pydantic untuk modul Payroll Engine & Penguncian Audit (FR-10)."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# PayrollRun
# ---------------------------------------------------------------------------

class PayrollRunCreate(BaseModel):
    """Membuat siklus penggajian Sabtu baru.

    FR-10.1 & FR-10.2: periode, persentase uang makan, dan rate bonus QC per pcs.
    """
    period_start: date = Field(..., description="Tanggal mulai periode kerja (biasanya Minggu)")
    period_end: date = Field(..., description="Tanggal akhir periode kerja (biasanya Sabtu)")
    meal_allowance_percentage: Decimal = Field(
        default=Decimal("12.00"),
        ge=Decimal("0"), le=Decimal("100"),
        description="Persentase uang makan dari total upah borongan (10–15%)",
    )
    qc_bonus_rate_per_pcs: Decimal = Field(
        default=Decimal("500.00"),
        ge=Decimal("0"),
        description="Rate bonus QC per pcs LOLOS (Rp)",
    )

    @model_validator(mode="after")
    def _period_must_be_valid(self) -> "PayrollRunCreate":
        if self.period_end < self.period_start:
            raise ValueError("period_end harus sama dengan atau setelah period_start.")
        return self


class PayrollDetailResponse(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    user_id: uuid.UUID
    total_sewing_fee: Decimal
    meal_allowance_amount: Decimal
    qc_bonus_share: Decimal
    net_salary: Decimal

    model_config = ConfigDict(from_attributes=True)


class PayrollRunResponse(BaseModel):
    id: uuid.UUID
    period_start: date
    period_end: date
    meal_allowance_percentage: Decimal
    qc_bonus_rate_per_pcs: Decimal
    total_qc_bonus_pool: Decimal
    is_locked: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollRunDetailResponse(PayrollRunResponse):
    """Payroll run lengkap beserta seluruh slip upah individu."""
    details: list[PayrollDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Kalkulasi Preview (sebelum disimpan)
# ---------------------------------------------------------------------------

class SlipPreview(BaseModel):
    """Preview slip upah satu penjahit sebelum payroll dikonfirmasi."""
    user_id: uuid.UUID
    username: str
    name: str
    role: str
    total_qty_completed: int
    total_sewing_fee: Decimal
    meal_allowance_amount: Decimal
    qc_bonus_share: Decimal
    net_salary: Decimal


class PayrollPreviewResponse(BaseModel):
    """Preview kalkulasi payroll sebelum dikonfirmasi dan disimpan."""
    period_start: date
    period_end: date
    meal_allowance_percentage: Decimal
    qc_bonus_rate_per_pcs: Decimal
    total_qc_bonus_pool: Decimal
    total_penjahit: int
    slips: list[SlipPreview]


# ---------------------------------------------------------------------------
# Lock
# ---------------------------------------------------------------------------

class PayrollLockResponse(BaseModel):
    """Konfirmasi penguncian payroll run."""
    run_id: uuid.UUID
    is_locked: bool
    message: str


# ---------------------------------------------------------------------------
# BatchFinancials (HPP & Laba/Rugi Batch Produksi - Activity Diagram)
# ---------------------------------------------------------------------------

class BatchFinancialCreate(BaseModel):
    order_id: uuid.UUID
    contract_revenue: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))
    material_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))
    overhead_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))


class BatchFinancialResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    contract_revenue: Decimal
    material_cost: Decimal
    overhead_cost: Decimal
    labor_cost: Decimal
    total_hpp: Decimal
    net_profit: Decimal
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
