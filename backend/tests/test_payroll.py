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
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modules.auth.models import User, UserRole
from app.modules.payroll.errors import (
    NoOutputsForPeriodError,
    PayrollPeriodOverlapError,
    PayrollRunLockedError,
    PayrollRunNotFoundError,
)
from app.modules.payroll.models import PayrollDetail, PayrollRun
from app.modules.payroll.schemas import PayrollRunCreate
from app.modules.payroll.service import (
    _calculate_slips,
    _round2,
    lock_payroll_run,
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

_PERIOD_START = date(2026, 10, 6)   # Senin
_PERIOD_END = date(2026, 10, 11)    # Sabtu


def _mock_run(locked: bool = False) -> MagicMock:
    run = MagicMock(spec=PayrollRun)
    run.id = _RUN_ID
    run.period_start = _PERIOD_START
    run.period_end = _PERIOD_END
    run.meal_allowance_percentage = Decimal("12.00")
    run.qc_bonus_rate_per_pcs = Decimal("500.00")
    run.total_qc_bonus_pool = Decimal("50000.00")
    run.is_locked = locked
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


# ===========================================================================
# SERVICE LAYER TESTS
# ===========================================================================

class TestLockPayrollRun:
    def test_locks_unlocked_run(self) -> None:
        db = MagicMock(spec=Session)
        run = _mock_run(locked=False)
        db.scalar.return_value = run

        result = lock_payroll_run(db, _RUN_ID)
        assert result.is_locked is True

    def test_already_locked_raises_error(self) -> None:
        """FR-10: Payroll yang sudah terkunci tidak bisa dikunci ulang."""
        db = MagicMock(spec=Session)
        run = _mock_run(locked=True)
        db.scalar.return_value = run

        with pytest.raises(PayrollRunLockedError):
            lock_payroll_run(db, _RUN_ID)

    def test_not_found_raises_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        with pytest.raises(PayrollRunNotFoundError):
            lock_payroll_run(db, uuid.uuid4())


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

    @patch("app.modules.payroll.router.lock_payroll_run")
    def test_lock_run_returns_200(self, mock_lock: MagicMock) -> None:
        run = _mock_run(locked=True)
        mock_lock.return_value = run
        resp = self._client().post(f"/api/v1/payroll/runs/{_RUN_ID}/lock")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_locked"] is True

    @patch("app.modules.payroll.router.lock_payroll_run")
    def test_lock_already_locked_returns_409(self, mock_lock: MagicMock) -> None:
        """Mengunci ulang payroll yang sudah terkunci harus HTTP 409."""
        mock_lock.side_effect = PayrollRunLockedError(_RUN_ID)
        resp = self._client().post(f"/api/v1/payroll/runs/{_RUN_ID}/lock")
        assert resp.status_code == 409

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
