"""Skema Pydantic untuk modul Payroll Engine & Penguncian Audit (FR-10)."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.auth.models import UserRole


class PayrollPaymentResponse(BaseModel):
    id: uuid.UUID
    payroll_detail_id: uuid.UUID
    paid_by_user_id: uuid.UUID
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollUserResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: UserRole

    model_config = ConfigDict(from_attributes=True)


class WorkerProductionNoteResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    order_number: str
    component_name: str
    line_number: int
    qty_completed: int
    is_verified: bool
    time_window: datetime


class WorkerPayrollSummaryResponse(BaseModel):
    run_id: uuid.UUID
    period_start: date
    period_end: date
    net_salary: Decimal
    payment_status: str
    scheduled_payment_date: date
    paid_at: datetime | None
    production_notes: list[WorkerProductionNoteResponse]


class PayrollNotificationResponse(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollFinanceReview(BaseModel):
    available_funds: Decimal = Field(
        ..., ge=Decimal("0"), max_digits=14, decimal_places=2
    )
    review_note: str | None = Field(None, max_length=1000)


class PayrollMonthlySummaryResponse(BaseModel):
    year: int
    month: int
    orders_created: int
    active_orders_now: int
    verified_output_entries: int
    verified_output_pcs: int
    qc_pass_pcs: int
    qc_repair_pcs: int
    qc_defect_pcs: int
    payroll_total: Decimal
    payroll_paid_total: Decimal
    contract_revenue: Decimal
    material_cost: Decimal
    overhead_cost: Decimal
    total_hpp: Decimal
    net_profit: Decimal
    overhead_per_unit: Decimal


# ---------------------------------------------------------------------------
# PayrollRun
# ---------------------------------------------------------------------------

class PayrollRunCreate(BaseModel):
    """Membuat siklus penggajian Sabtu baru.

    FR-10.1 & FR-10.2: periode, persentase uang makan, dan rate bonus QC per pcs.
    """
    period_start: date = Field(..., description="Tanggal mulai periode kerja (Senin)")
    period_end: date = Field(..., description="Tanggal akhir periode kerja (Sabtu)")
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
        if self.period_start.weekday() != 0 or self.period_end.weekday() != 5:
            raise ValueError("Periode payroll harus dimulai hari Senin dan berakhir hari Sabtu.")
        if (self.period_end - self.period_start).days != 5:
            raise ValueError("Periode payroll harus mencakup satu pekan kerja Senin sampai Sabtu.")
        return self


class PayrollDetailResponse(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    user_id: uuid.UUID
    total_sewing_fee: Decimal
    meal_allowance_amount: Decimal
    qc_bonus_share: Decimal
    net_salary: Decimal
    user: PayrollUserResponse
    payment: PayrollPaymentResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class PayrollRunResponse(BaseModel):
    id: uuid.UUID
    period_start: date
    period_end: date
    meal_allowance_percentage: Decimal
    qc_bonus_rate_per_pcs: Decimal
    total_qc_bonus_pool: Decimal
    is_locked: bool
    funding_status: str
    available_funds: Decimal | None
    reviewed_by_user_id: uuid.UUID | None
    reviewed_at: datetime | None
    review_note: str | None
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
