"""Unit test modul Quality Control, Defect, dan Pool Bonus QC (FR-9, FR-10.3).

Pengujian mencakup Skenario 3 (P0):
  - Pencatatan inspeksi QC (LOLOS / REPAIR / DEFECT)
  - Guard: order bukan status QC ditolak
  - Guard: qty inspeksi harus > 0
  - Otomatis majukan status MENUNGGU_QC → QC saat inspeksi pertama
  - Ringkasan QC: total, lolos, repair, defect, persentase
  - Pool Bonus QC 3-arah: total pool = lolos × rate, dibagi rata ke MANDOR
  - Guard: pool bonus kosong (0 pcs lolos)
  - Guard: tidak ada penerima bonus
  - Endpoint HTTP: status codes
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modules.auth.models import User, UserRole
from app.modules.produksi.models import Order, OrderStatus
from app.modules.qc.errors import (
    InspectionNotFoundError,
    InvalidQCQuantityError,
    NoBonusRecipientsError,
    OrderNotInQCStatusError,
    QCBonusPoolEmptyError,
)
from app.modules.qc.models import QCInspection, QCStatus
from app.modules.qc.schemas import QCInspectionCreate, QCBonusConfig
from app.modules.qc.service import (
    calculate_qc_bonus_pool,
    get_qc_summary,
    record_inspection,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)
_ORDER_ID = uuid.uuid4()
_USER_ID = uuid.uuid4()
_MANDOR1_ID = uuid.uuid4()
_MANDOR2_ID = uuid.uuid4()
_KAOPS_ID = uuid.uuid4()


def _mock_order(status: OrderStatus) -> MagicMock:
    o = MagicMock(spec=Order)
    o.id = _ORDER_ID
    o.status = status
    return o


def _mock_mandor(uid: uuid.UUID, username: str, name: str) -> MagicMock:
    u = MagicMock(spec=User)
    u.id = uid
    u.username = username
    u.name = name
    u.role = UserRole.MANDOR
    u.is_active = True
    return u


# ===========================================================================
# SERVICE LAYER TESTS
# ===========================================================================

class TestRecordInspection:
    def test_records_lolos_inspection(self) -> None:
        """Inspeksi LOLOS berhasil dicatat untuk order status QC."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.QC)
        db.scalar.return_value = order

        captured: list = []
        db.add.side_effect = captured.append

        payload = QCInspectionCreate(
            order_id=_ORDER_ID,
            status=QCStatus.LOLOS,
            qty_inspected=50,
        )
        record_inspection(db, payload, inspector_user_id=_USER_ID)

        ins = captured[0]
        assert isinstance(ins, QCInspection)
        assert ins.status == QCStatus.LOLOS
        assert ins.qty_inspected == 50
        assert ins.inspector_user_id == _USER_ID

    def test_menunggu_qc_auto_advances_to_qc(self) -> None:
        """Status MENUNGGU_QC otomatis maju ke QC saat inspeksi pertama."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.MENUNGGU_QC)
        db.scalar.return_value = order

        db.add.side_effect = lambda x: None

        payload = QCInspectionCreate(
            order_id=_ORDER_ID,
            status=QCStatus.LOLOS,
            qty_inspected=10,
        )
        record_inspection(db, payload, inspector_user_id=_USER_ID)
        assert order.status == OrderStatus.QC

    def test_wrong_status_raises_error(self) -> None:
        """Order yang bukan MENUNGGU_QC/QC tidak bisa diinspeksi."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        db.scalar.return_value = order

        payload = QCInspectionCreate(
            order_id=_ORDER_ID,
            status=QCStatus.LOLOS,
            qty_inspected=10,
        )
        with pytest.raises(OrderNotInQCStatusError):
            record_inspection(db, payload, inspector_user_id=_USER_ID)

    def test_zero_qty_raises_error(self) -> None:
        """qty_inspected = 0 ditolak oleh Pydantic schema (gt=0)."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            QCInspectionCreate(
                order_id=_ORDER_ID,
                status=QCStatus.LOLOS,
                qty_inspected=0,
            )

    def test_defect_inspection_recorded(self) -> None:
        """Inspeksi DEFECT dengan kategori berhasil dicatat."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.QC)
        db.scalar.return_value = order

        captured: list = []
        db.add.side_effect = captured.append

        payload = QCInspectionCreate(
            order_id=_ORDER_ID,
            status=QCStatus.DEFECT,
            qty_inspected=5,
            defect_category="Jahitan Loncat",
        )
        record_inspection(db, payload, inspector_user_id=_USER_ID)

        ins = captured[0]
        assert ins.status == QCStatus.DEFECT
        assert ins.defect_category == "Jahitan Loncat"


class TestGetQCSummary:
    def test_calculates_correct_summary(self) -> None:
        """Ringkasan QC harus menghitung persentase dengan benar."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.QC)
        # scalar calls: 1=order, 2=lolos(80), 3=repair(10), 4=defect(10)
        db.scalar.side_effect = [order, 80, 10, 10]

        summary = get_qc_summary(db, _ORDER_ID)

        assert summary.qty_lolos == 80
        assert summary.qty_repair == 10
        assert summary.qty_defect == 10
        assert summary.total_inspected == 100
        assert summary.lolos_pct == 80.0
        assert summary.defect_pct == 20.0

    def test_no_inspections_returns_zeros(self) -> None:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.QC)
        db.scalar.side_effect = [order, 0, 0, 0]

        summary = get_qc_summary(db, _ORDER_ID)
        assert summary.total_inspected == 0
        assert summary.lolos_pct == 0.0
        assert summary.defect_pct == 0.0


class TestCalculateQCBonusPool:
    def _setup_db(self, qty_lolos: int, mandors: list) -> MagicMock:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.QC)
        # scalars calls: order, qty_lolos
        db.scalar.side_effect = [order, qty_lolos]
        # scalars() for mandor list
        db.scalars.return_value = MagicMock()
        db.scalars.return_value.all.return_value = mandors
        return db

    def test_pool_divided_equally_among_3_mandors(self) -> None:
        """FR-10.3: Pool bonus dibagi rata ke 3 MANDOR."""
        m1 = _mock_mandor(_MANDOR1_ID, "mandor_agus", "Agus")
        m2 = _mock_mandor(_MANDOR2_ID, "mandor_joko", "Joko")
        m3 = _mock_mandor(_KAOPS_ID, "ka_ops", "Kepala Ops")

        db = self._setup_db(qty_lolos=500, mandors=[m1, m2, m3])

        result = calculate_qc_bonus_pool(db, _ORDER_ID, Decimal("500.00"))

        assert result.qty_lolos == 500
        assert result.total_pool == Decimal("250000.00")
        assert result.recipient_count == 3
        # 250000 / 3 = 83333.33...
        assert result.bonus_per_recipient == Decimal("83333.33")
        assert len(result.recipients) == 3

    def test_pool_empty_raises_error(self) -> None:
        """Pool kosong (0 pcs lolos) harus ditolak."""
        m1 = _mock_mandor(_MANDOR1_ID, "mandor_agus", "Agus")
        db = self._setup_db(qty_lolos=0, mandors=[m1])

        with pytest.raises(QCBonusPoolEmptyError):
            calculate_qc_bonus_pool(db, _ORDER_ID, Decimal("500.00"))

    def test_no_mandor_raises_error(self) -> None:
        """Tidak ada MANDOR aktif harus ditolak."""
        db = self._setup_db(qty_lolos=100, mandors=[])

        with pytest.raises(NoBonusRecipientsError):
            calculate_qc_bonus_pool(db, _ORDER_ID, Decimal("500.00"))

    def test_two_mandors_bonus_split(self) -> None:
        """Pembagian bonus ke 2 MANDOR dengan rate 1000/pcs."""
        m1 = _mock_mandor(_MANDOR1_ID, "mandor_agus", "Agus")
        m2 = _mock_mandor(_MANDOR2_ID, "mandor_joko", "Joko")
        db = self._setup_db(qty_lolos=200, mandors=[m1, m2])

        result = calculate_qc_bonus_pool(db, _ORDER_ID, Decimal("1000.00"))

        assert result.total_pool == Decimal("200000.00")
        assert result.bonus_per_recipient == Decimal("100000.00")
        assert result.recipient_count == 2


# ===========================================================================
# HTTP / ENDPOINT TESTS
# ===========================================================================

_MOCK_INSPECTOR = User(
    id=_USER_ID, username="qc_dewi", role=UserRole.QC_INSPECTOR,
    client_id=None, hashed_password="x", name="Dewi QC",
)

_MOCK_OWNER = User(
    id=uuid.uuid4(), username="owner", role=UserRole.OWNER,
    client_id=None, hashed_password="x", name="Owner",
)


class TestQCEndpoints:
    def _client(self, user_fn=None) -> TestClient:
        from app.modules.auth.dependencies import get_current_user, require_roles
        app.dependency_overrides[get_current_user] = user_fn or (lambda: _MOCK_INSPECTOR)
        app.dependency_overrides[require_roles] = lambda roles: lambda: None  # type: ignore[assignment]
        return TestClient(app, raise_server_exceptions=False)

    def teardown_method(self) -> None:
        app.dependency_overrides.clear()

    @patch("app.modules.qc.router.list_inspections")
    def test_get_inspections_returns_200(self, mock_list: MagicMock) -> None:
        mock_list.return_value = []
        resp = self._client().get("/api/v1/qc/inspections")
        assert resp.status_code == 200

    @patch("app.modules.qc.router.record_inspection")
    def test_post_inspection_returns_201(self, mock_record: MagicMock) -> None:
        ins = MagicMock(spec=QCInspection)
        ins.id = uuid.uuid4()
        ins.order_id = _ORDER_ID
        ins.production_output_id = None
        ins.inspector_user_id = _USER_ID
        ins.status = QCStatus.LOLOS
        ins.qty_inspected = 50
        ins.defect_category = None
        ins.notes = None
        ins.inspected_at = _NOW
        mock_record.return_value = ins

        resp = self._client().post(
            "/api/v1/qc/inspections",
            json={
                "order_id": str(_ORDER_ID),
                "status": "LOLOS",
                "qty_inspected": 50,
            },
        )
        assert resp.status_code == 201

    @patch("app.modules.qc.router.record_inspection")
    def test_post_inspection_wrong_status_returns_409(self, mock_record: MagicMock) -> None:
        mock_record.side_effect = OrderNotInQCStatusError(_ORDER_ID, "SEWING")
        resp = self._client().post(
            "/api/v1/qc/inspections",
            json={"order_id": str(_ORDER_ID), "status": "LOLOS", "qty_inspected": 10},
        )
        assert resp.status_code == 409

    @patch("app.modules.qc.router.calculate_qc_bonus_pool")
    def test_post_bonus_pool_returns_200(self, mock_calc: MagicMock) -> None:
        from app.modules.qc.schemas import QCBonusPoolResponse, BonusRecipient
        mock_calc.return_value = QCBonusPoolResponse(
            order_id=_ORDER_ID,
            qty_lolos=500,
            bonus_rate_per_pcs=Decimal("500.00"),
            total_pool=Decimal("250000.00"),
            recipient_count=3,
            bonus_per_recipient=Decimal("83333.33"),
            recipients=[
                BonusRecipient(
                    user_id=_MANDOR1_ID, username="mandor_agus", name="Agus",
                    role="MANDOR", bonus_amount=Decimal("83333.33"),
                )
            ],
        )
        resp = self._client(lambda: _MOCK_OWNER).post(
            f"/api/v1/qc/bonus/{_ORDER_ID}",
            json={"bonus_rate_per_pcs": "500.00"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_pool"] == "250000.00"
        assert data["recipient_count"] == 3

    @patch("app.modules.qc.router.calculate_qc_bonus_pool")
    def test_post_bonus_pool_empty_returns_422(self, mock_calc: MagicMock) -> None:
        mock_calc.side_effect = QCBonusPoolEmptyError(_ORDER_ID)
        resp = self._client(lambda: _MOCK_OWNER).post(
            f"/api/v1/qc/bonus/{_ORDER_ID}",
            json={"bonus_rate_per_pcs": "500.00"},
        )
        assert resp.status_code == 422

    @patch("app.modules.qc.router.list_escalations_to_sample")
    def test_get_escalations_returns_200(self, mock_list: MagicMock) -> None:
        mock_insp = MagicMock()
        mock_insp.id = uuid.uuid4()
        mock_insp.order_id = _ORDER_ID
        mock_insp.production_output_id = None
        mock_insp.status = QCStatus.REPAIR
        mock_insp.qty_inspected = 5
        mock_insp.defect_category = "SEWING"
        mock_insp.notes = "Jahitan melenceng 3x"
        mock_insp.repair_count = 3
        mock_insp.escalated_to_sample = True
        mock_insp.inspector_user_id = _USER_ID
        mock_insp.inspected_at = _NOW
        mock_list.return_value = [mock_insp]

        resp = self._client().get("/api/v1/qc/escalations")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["repair_count"] == 3
        assert data[0]["escalated_to_sample"] is True
