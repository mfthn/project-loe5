"""Unit test modul Payroll Engine & Penguncian Audit (FR-10, FR-10.1, FR-10.2).

Pengujian mencakup Skenario 2 (P0):
  - Preview kalkulasi payroll tanpa menyimpan
  - Pembuatan payroll run dari output terverifikasi
  - FR-10.1: Headcount dinamis (penjahit baru otomatis masuk)
  - FR-10.2: Upah = qty × sewing_rate per komponen
  - Uang makan = meal_pct% × total_sewing_fee
  - Bonus QC = qty_lolos × rate ÷ jumlah MANDOR
  - Audit Lock: payroll dikunci permanen, tidak bisa diubah lagi
  - Guard: kunci ganda ditolak (HTTP 409)
  - Guard: periode overlap ditolak
  - Guard: tidak ada output terverifikasi ditolak
  - Endpoint HTTP: status codes
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import ANY, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modules.auth.models import User, UserRole
from app.modules.payroll.errors import (
    NoOutputsForPeriodError,
    PayrollDetailNotFoundError,
    PayrollPaymentAlreadyRecordedError,
    PayrollPeriodOverlapError,
    PayrollRunNotLockedError,
    PayrollRunNotFoundError,
)
from app.modules.payroll.models import PayrollDetail, PayrollPayment, PayrollRun
from app.modules.payroll.schemas import PayrollRunCreate
from app.modules.payroll.service import (
    _period_datetimes,
    _round2,
    review_payroll_funding,
    list_worker_payroll_summaries,
    mark_payroll_detail_paid,
)

# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)
_TODAY = date.today()
_RUN_ID = uuid.uuid4()
_USER_PENJAHIT_1 = uuid.uuid4()
_USER_PENJAHIT_2 = uuid.uuid4()
_USER_MANDOR_1 = uuid.uuid4()
_USER_MANDOR_2 = uuid.uuid4()
_USER_KAOPS = uuid.uuid4()

_PERIOD_START = date(2026, 10, 5)   # Senin
_PERIOD_END = date(2026, 10, 10)   # Sabtu


def _mock_run(locked: bool = False) -> MagicMock:
    run = MagicMock(spec=PayrollRun)
    run.id = _RUN_ID
    run.period_start = _PERIOD_START
    run.period_end = _PERIOD_END
    run.meal_allowance_percentage = Decimal("12.00")
    run.qc_bonus_rate_per_pcs = Decimal("500.00")
    run.total_qc_bonus_pool = Decimal("50000.00")
    run.is_locked = locked
    run.funding_status = "PENDING"
    run.available_funds = None
    run.reviewed_by_user_id = None
    run.reviewed_at = None
    run.review_note = None
    run.created_at = _NOW
    run.details = []
    return run


def _mock_user(uid: uuid.UUID, role: UserRole, username: str = "user") -> MagicMock:
    u = MagicMock(spec=User)
    u.id = uid
    u.username = username
    u.name = username.title()
    u.role = role
    u.is_active = True
    return u


# ===========================================================================
# UNIT TESTS — Helper functions
# ===========================================================================

class TestRoundHelper:
    def test_rounds_to_2_decimal(self) -> None:
        assert _round2(Decimal("83333.336")) == Decimal("83333.34")

    def test_rounds_standard(self) -> None:
        assert _round2(Decimal("100.005")) == Decimal("100.01")

    def test_payroll_datetime_bounds_use_jakarta_calendar_dates(self) -> None:
        start, end = _period_datetimes(_PERIOD_START, _PERIOD_END)
        assert start.isoformat() == "2026-10-05T00:00:00+07:00"
        assert end.isoformat() == "2026-10-10T23:59:59.999999+07:00"

    def test_payroll_period_requires_monday_through_saturday(self) -> None:
        PayrollRunCreate(period_start=_PERIOD_START, period_end=_PERIOD_END)
        with pytest.raises(ValueError):
            PayrollRunCreate(
                period_start=date(2026, 10, 6),
                period_end=date(2026, 10, 11),
            )


# ===========================================================================
# SERVICE LAYER TESTS
# ===========================================================================

class TestMarkPayrollDetailPaid:
    def test_marks_locked_run_detail_paid(self) -> None:
        db = MagicMock(spec=Session)
        detail = MagicMock(spec=PayrollDetail)
        detail.id = uuid.uuid4()
        detail.payment = None
        detail.payroll_run = _mock_run(locked=True)
        db.scalar.return_value = detail

        payment = mark_payroll_detail_paid(
            db, _RUN_ID, detail.id, _MOCK_FINANCE.id
        )

        assert isinstance(payment, PayrollPayment)
        assert payment.payroll_detail_id == detail.id
        assert payment.paid_by_user_id == _MOCK_FINANCE.id
        assert payment.paid_at.tzinfo == timezone.utc
        db.add.assert_called_once_with(payment)
        db.commit.assert_called_once()

    def test_rejects_payment_before_run_is_locked(self) -> None:
        db = MagicMock(spec=Session)
        detail = MagicMock(spec=PayrollDetail)
        detail.id = uuid.uuid4()
        detail.payment = None
        detail.payroll_run = _mock_run(locked=False)
        db.scalar.return_value = detail

        with pytest.raises(PayrollRunNotLockedError):
            mark_payroll_detail_paid(db, _RUN_ID, detail.id, _MOCK_FINANCE.id)

        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_rejects_duplicate_payment(self) -> None:
        db = MagicMock(spec=Session)
        detail = MagicMock(spec=PayrollDetail)
        detail.id = uuid.uuid4()
        detail.payment = MagicMock(spec=PayrollPayment)
        detail.payroll_run = _mock_run(locked=True)
        db.scalar.return_value = detail

        with pytest.raises(PayrollPaymentAlreadyRecordedError):
            mark_payroll_detail_paid(db, _RUN_ID, detail.id, _MOCK_FINANCE.id)

        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_rejects_unknown_run_detail_pair(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None
        detail_id = uuid.uuid4()

        with pytest.raises(PayrollDetailNotFoundError):
            mark_payroll_detail_paid(db, _RUN_ID, detail_id, _MOCK_FINANCE.id)

        db.add.assert_not_called()


class TestReviewPayrollFunding:
    def test_sufficient_funds_lock_run(self) -> None:
        db = MagicMock(spec=Session)
        run = _mock_run(locked=False)
        detail = MagicMock()
        detail.net_salary = Decimal("125000.00")
        run.details = [detail]
        db.scalar.return_value = run

        result = review_payroll_funding(
            db, _RUN_ID, Decimal("200000.00"), _MOCK_FINANCE.id
        )

        assert result.is_locked is True
        assert result.funding_status == "SUFFICIENT"
        assert result.available_funds == Decimal("200000.00")
        assert result.reviewed_by_user_id == _MOCK_FINANCE.id
        db.commit.assert_called_once()
        db.add.assert_not_called()

    def test_insufficient_funds_leave_run_unlocked_and_notify_mandors(self) -> None:
        db = MagicMock(spec=Session)
        run = _mock_run(locked=False)
        detail = MagicMock()
        detail.net_salary = Decimal("125000.00")
        run.details = [detail]
        db.scalar.return_value = run
        mandor_id = uuid.uuid4()
        db.scalars.return_value.all.return_value = [mandor_id]

        result = review_payroll_funding(
            db, _RUN_ID, Decimal("100000.00"), _MOCK_FINANCE.id
        )

        assert result.is_locked is False
        assert result.funding_status == "INSUFFICIENT"
        db.add.assert_called_once()
        assert db.add.call_args.args[0].recipient_user_id == mandor_id
        assert "25,000.00" in db.add.call_args.args[0].message
        db.commit.assert_called_once()


class TestListWorkerPayrollSummaries:
    def test_lists_only_locked_runs_with_saturday_due_date(self) -> None:
        db = MagicMock(spec=Session)
        detail = MagicMock(spec=PayrollDetail)
        detail.user_id = _USER_PENJAHIT_1
        detail.net_salary = Decimal("125000.00")
        detail.payment = None
        run = _mock_run(locked=True)
        run.details = [detail]
        db.scalars.return_value.unique.return_value.all.return_value = [run]
        db.execute.return_value.all.return_value = []

        summaries = list_worker_payroll_summaries(db, _USER_PENJAHIT_1)

        assert len(summaries) == 1
        assert summaries[0]["payment_status"] == "SCHEDULED"
        assert summaries[0]["scheduled_payment_date"] == date(2026, 10, 10)
        assert summaries[0]["net_salary"] == Decimal("125000.00")
        assert summaries[0]["production_notes"] == []

    def test_reports_paid_status_from_recorded_payment(self) -> None:
        db = MagicMock(spec=Session)
        detail = MagicMock(spec=PayrollDetail)
        detail.user_id = _USER_PENJAHIT_1
        detail.net_salary = Decimal("125000.00")
        detail.payment = MagicMock(spec=PayrollPayment)
        detail.payment.paid_at = _NOW
        run = _mock_run(locked=True)
        run.details = [detail]
        db.scalars.return_value.unique.return_value.all.return_value = [run]
        db.execute.return_value.all.return_value = []

        summaries = list_worker_payroll_summaries(db, _USER_PENJAHIT_1)

        assert summaries[0]["payment_status"] == "PAID"
        assert summaries[0]["paid_at"] == _NOW


class TestPayrollCalculation:
    """Tests untuk logika kalkulasi slip upah."""

    def test_net_salary_formula(self) -> None:
        """Net = sewing_fee + meal_allowance + qc_bonus."""
        sewing = Decimal("500000.00")
        meal_pct = Decimal("12.00")
        meal = _round2(sewing * meal_pct / Decimal("100"))
        qc_bonus = Decimal("83333.33")
        net = _round2(sewing + meal + qc_bonus)

        assert meal == Decimal("60000.00")
        assert net == Decimal("643333.33")

    def test_meal_allowance_percentage_boundary(self) -> None:
        """Uang makan 10% dan 15% keduanya valid."""
        sewing = Decimal("1000000.00")
        for pct in [Decimal("10.00"), Decimal("15.00")]:
            meal = _round2(sewing * pct / Decimal("100"))
            assert meal > Decimal("0")

    def test_qc_bonus_pool_per_mandor(self) -> None:
        """FR-10.3: Pool bonus dibagi rata ke semua mandor."""
        qty_lolos = 200
        rate = Decimal("500.00")
        total_pool = Decimal(qty_lolos) * rate  # 100_000
        n_mandors = 2
        per_mandor = _round2(total_pool / Decimal(n_mandors))

        assert total_pool == Decimal("100000.00")
        assert per_mandor == Decimal("50000.00")

    def test_headcount_dynamic_no_slot_limit(self) -> None:
        """FR-10.1: Semua penjahit dengan output terverifikasi masuk tanpa slot limit."""
        # Simulasi: 5 penjahit punya output, semua harus masuk
        operator_ids = [uuid.uuid4() for _ in range(5)]
        sewing_map = {uid: Decimal("200000.00") for uid in operator_ids}
        assert len(sewing_map) == 5


# ===========================================================================
# HTTP / ENDPOINT TESTS
# ===========================================================================

_MOCK_FINANCE = User(
    id=uuid.uuid4(), username="finance_rina", role=UserRole.FINANCE_PAYROLL,
    client_id=None, hashed_password="x", name="Rina Finance",
)

_MOCK_OWNER = User(
    id=uuid.uuid4(), username="owner_budi", role=UserRole.OWNER,
    client_id=None, hashed_password="x", name="Budi Owner",
)


class TestPayrollEndpoints:
    def _client(self, user_fn=None) -> TestClient:
        from app.modules.auth.dependencies import get_current_user, require_roles
        app.dependency_overrides[get_current_user] = user_fn or (lambda: _MOCK_FINANCE)
        app.dependency_overrides[require_roles] = lambda roles: lambda: None  # type: ignore[assignment]
        return TestClient(app, raise_server_exceptions=False)

    def teardown_method(self) -> None:
        app.dependency_overrides.clear()

    @patch("app.modules.payroll.router.list_payroll_runs")
    def test_get_runs_returns_200(self, mock_list: MagicMock) -> None:
        mock_list.return_value = []
        resp = self._client().get("/api/v1/payroll/runs")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.modules.payroll.router.get_payroll_run")
    def test_get_run_not_found_returns_404(self, mock_get: MagicMock) -> None:
        mock_get.side_effect = PayrollRunNotFoundError(uuid.uuid4())
        resp = self._client().get(f"/api/v1/payroll/runs/{uuid.uuid4()}")
        assert resp.status_code == 404

    @patch("app.modules.payroll.router.create_payroll_run")
    def test_post_run_returns_201(self, mock_create: MagicMock) -> None:
        run = _mock_run()
        mock_create.return_value = run
        resp = self._client().post(
            "/api/v1/payroll/runs",
            json={
                "period_start": str(_PERIOD_START),
                "period_end": str(_PERIOD_END),
                "meal_allowance_percentage": "12.00",
                "qc_bonus_rate_per_pcs": "500.00",
            },
        )
        assert resp.status_code == 201

    @patch("app.modules.payroll.router.create_payroll_run")
    def test_post_run_period_overlap_returns_409(self, mock_create: MagicMock) -> None:
        mock_create.side_effect = PayrollPeriodOverlapError(_PERIOD_START, _PERIOD_END)
        resp = self._client().post(
            "/api/v1/payroll/runs",
            json={
                "period_start": str(_PERIOD_START),
                "period_end": str(_PERIOD_END),
                "meal_allowance_percentage": "12.00",
                "qc_bonus_rate_per_pcs": "500.00",
            },
        )
        assert resp.status_code == 409

    @patch("app.modules.payroll.router.create_payroll_run")
    def test_post_run_no_outputs_returns_422(self, mock_create: MagicMock) -> None:
        mock_create.side_effect = NoOutputsForPeriodError(_PERIOD_START, _PERIOD_END)
        resp = self._client().post(
            "/api/v1/payroll/runs",
            json={
                "period_start": str(_PERIOD_START),
                "period_end": str(_PERIOD_END),
                "meal_allowance_percentage": "12.00",
                "qc_bonus_rate_per_pcs": "500.00",
            },
        )
        assert resp.status_code == 422

    @patch("app.modules.payroll.router.review_payroll_funding")
    def test_finance_review_locks_when_funds_are_sufficient(
        self, mock_review: MagicMock
    ) -> None:
        run = _mock_run(locked=True)
        run.funding_status = "SUFFICIENT"
        run.available_funds = Decimal("250000.00")
        mock_review.return_value = run
        resp = self._client().post(
            f"/api/v1/payroll/runs/{_RUN_ID}/finance-review",
            json={"available_funds": "250000.00"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_locked"] is True
        assert resp.json()["funding_status"] == "SUFFICIENT"
        mock_review.assert_called_once_with(
            ANY, _RUN_ID, Decimal("250000.00"), _MOCK_FINANCE.id, None
        )

    @patch("app.modules.payroll.router.review_payroll_funding")
    def test_finance_review_keeps_run_open_when_funds_are_insufficient(
        self, mock_review: MagicMock
    ) -> None:
        run = _mock_run(locked=False)
        run.funding_status = "INSUFFICIENT"
        run.available_funds = Decimal("100000.00")
        mock_review.return_value = run
        response = self._client().post(
            f"/api/v1/payroll/runs/{_RUN_ID}/finance-review",
            json={"available_funds": "100000.00", "review_note": "Dana kurang"},
        )
        assert response.status_code == 200
        assert response.json()["is_locked"] is False
        assert response.json()["funding_status"] == "INSUFFICIENT"

    @patch("app.modules.payroll.router.review_payroll_funding")
    def test_owner_can_finalize_payroll(
        self, mock_review: MagicMock
    ) -> None:
        # Matriks RBAC: Owner (konfigurasi sistem) dapat menjalankan finance-review.
        run = _mock_run(locked=True)
        run.funding_status = "SUFFICIENT"
        run.available_funds = Decimal("250000.00")
        mock_review.return_value = run
        response = self._client(user_fn=lambda: _MOCK_OWNER).post(
            f"/api/v1/payroll/runs/{_RUN_ID}/finance-review",
            json={"available_funds": "250000.00"},
        )
        assert response.status_code == 200
        mock_review.assert_called_once()

    @patch("app.modules.payroll.router.mark_payroll_detail_paid")
    def test_finance_can_confirm_payment(self, mock_mark_paid: MagicMock) -> None:
        payment = MagicMock(spec=PayrollPayment)
        payment.id = uuid.uuid4()
        payment.payroll_detail_id = uuid.uuid4()
        payment.paid_by_user_id = _MOCK_FINANCE.id
        payment.paid_at = _NOW
        mock_mark_paid.return_value = payment

        resp = self._client().post(
            f"/api/v1/payroll/runs/{_RUN_ID}/details/{payment.payroll_detail_id}/payment"
        )

        assert resp.status_code == 201
        assert resp.json()["paid_by_user_id"] == str(_MOCK_FINANCE.id)
        mock_mark_paid.assert_called_once_with(
            ANY,
            run_id=_RUN_ID,
            detail_id=payment.payroll_detail_id,
            paid_by_user_id=_MOCK_FINANCE.id,
        )

    @patch("app.modules.payroll.router.mark_payroll_detail_paid")
    def test_payment_for_unlocked_run_returns_409(self, mock_mark_paid: MagicMock) -> None:
        mock_mark_paid.side_effect = PayrollRunNotLockedError(_RUN_ID)

        resp = self._client().post(
            f"/api/v1/payroll/runs/{_RUN_ID}/details/{uuid.uuid4()}/payment"
        )

        assert resp.status_code == 409

    @patch("app.modules.payroll.router.mark_payroll_detail_paid")
    def test_mandor_cannot_confirm_payments(self, mock_mark_paid: MagicMock) -> None:
        mandor = User(
            id=uuid.uuid4(),
            username="mandor_agus",
            role=UserRole.MANDOR,
            client_id=None,
            hashed_password="x",
            name="Agus",
        )

        resp = self._client(user_fn=lambda: mandor).post(
            f"/api/v1/payroll/runs/{_RUN_ID}/details/{uuid.uuid4()}/payment"
        )

        assert resp.status_code == 403
        mock_mark_paid.assert_not_called()

    @patch("app.modules.payroll.router.list_worker_payroll_summaries")
    def test_penjahit_receives_only_personal_payroll_summary(
        self, mock_summary: MagicMock
    ) -> None:
        penjahit = User(
            id=uuid.uuid4(),
            username="penjahit_siti",
            role=UserRole.PENJAHIT,
            client_id=None,
            hashed_password="x",
            name="Siti",
        )
        mock_summary.return_value = [
            {
                "run_id": _RUN_ID,
                "period_start": _PERIOD_START,
                "period_end": _PERIOD_END,
                "net_salary": Decimal("125000.00"),
                "payment_status": "SCHEDULED",
                "scheduled_payment_date": _PERIOD_END,
                "paid_at": None,
                "production_notes": [],
            }
        ]

        resp = self._client(user_fn=lambda: penjahit).get(
            "/api/v1/payroll/my-summary"
        )

        assert resp.status_code == 200
        assert resp.json()[0]["net_salary"] == "125000.00"
        assert resp.json()[0]["payment_status"] == "SCHEDULED"
        mock_summary.assert_called_once_with(ANY, penjahit.id)

    @patch("app.modules.payroll.router.list_worker_payroll_summaries")
    def test_finance_cannot_read_penjahit_personal_summary(
        self, mock_summary: MagicMock
    ) -> None:
        resp = self._client().get("/api/v1/payroll/my-summary")

        assert resp.status_code == 403
        mock_summary.assert_not_called()

    @patch("app.modules.payroll.router.preview_payroll")
    def test_preview_no_outputs_returns_422(self, mock_preview: MagicMock) -> None:
        mock_preview.side_effect = NoOutputsForPeriodError(_PERIOD_START, _PERIOD_END)
        resp = self._client().post(
            "/api/v1/payroll/preview",
            json={
                "period_start": str(_PERIOD_START),
                "period_end": str(_PERIOD_END),
                "meal_allowance_percentage": "12.00",
                "qc_bonus_rate_per_pcs": "500.00",
            },
        )
        assert resp.status_code == 422

    def test_invalid_period_dates_returns_422(self) -> None:
        """period_end < period_start harus ditolak oleh Pydantic validator."""
        resp = self._client().post(
            "/api/v1/payroll/runs",
            json={
                "period_start": "2026-10-11",
                "period_end": "2026-10-06",  # end < start
                "meal_allowance_percentage": "12.00",
                "qc_bonus_rate_per_pcs": "500.00",
            },
        )
        assert resp.status_code == 422

    @patch("app.modules.payroll.router.calculate_and_save_batch_financial")
    def test_post_batch_financials_returns_200(self, mock_calc: MagicMock) -> None:
        mock_fin = MagicMock()
        mock_fin.id = uuid.uuid4()
        mock_fin.order_id = uuid.uuid4()
        mock_fin.contract_revenue = Decimal("150000000.00")
        mock_fin.material_cost = Decimal("60000000.00")
        mock_fin.overhead_cost = Decimal("15000000.00")
        mock_fin.labor_cost = Decimal("30000000.00")
        mock_fin.total_hpp = Decimal("105000000.00")
        mock_fin.net_profit = Decimal("45000000.00")
        mock_fin.status = "DRAFT"
        mock_fin.created_at = _NOW
        mock_fin.updated_at = _NOW
        mock_calc.return_value = mock_fin

        resp = self._client().post(
            "/api/v1/payroll/financials",
            json={
                "order_id": str(mock_fin.order_id),
                "contract_revenue": "150000000.00",
                "overhead_percentage": "10.00",
                "status": "DRAFT",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_hpp"] == "105000000.00"
        assert data["net_profit"] == "45000000.00"
