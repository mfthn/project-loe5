"""Unit test modul Produksi, Order Massal, dan Terminal 30 Menit (FR-7, FR-8, FR-9).

Pengujian mencakup:
  - Pembuatan order baru dengan komponen + rate card
  - Konversi sample APPROVED → order massal (Skenario 4 FR-4.1)
  - Guard: sample belum APPROVED ditolak
  - Guard: nomor order duplikat ditolak
  - Transisi status order (SAMPLE → CUTTING → SEWING dst.)
  - Guard: transisi status tidak valid ditolak
  - Pencatatan output 30 menit oleh penjahit
  - Guard: output hanya bisa dicatat saat status SEWING
  - Verifikasi output oleh mandor
  - Ringkasan output vs target
  - Endpoint HTTP: status codes
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modules.auth.models import User, UserRole
from app.modules.produksi.errors import (
    InvalidOutputQuantityError,
    OrderNotFoundError,
    OrderNumberDuplicateError,
    OrderStatusTransitionError,
    SampleVersionNotApprovedError,
)
from app.modules.produksi.models import (
    Order,
    OrderComponent,
    OrderStatus,
    ProductionOutput,
    RateCard,
    MaklonScheme,
)
from app.modules.produksi.schemas import (
    OrderComponentCreate,
    OrderCreate,
    OrderFromSampleCreate,
    ProductionOutputCreate,
)
from app.modules.produksi.service import (
    create_order,
    create_order_from_sample,
    get_worker_dashboard_summary,
    get_order_output_summary,
    record_output,
    update_order_status,
    verify_output,
)
from app.modules.qc.models import QCStatus
from app.modules.sample.models import SampleStatus, SampleVersion


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)
_CLIENT_ID = uuid.uuid4()
_ORDER_ID = uuid.uuid4()
_VERSION_ID = uuid.uuid4()
_USER_ID = uuid.uuid4()
_COMP_ID = uuid.uuid4()


def _mock_order(status: OrderStatus = OrderStatus.SAMPLE) -> MagicMock:
    o = MagicMock(spec=Order)
    o.id = _ORDER_ID
    o.client_id = _CLIENT_ID
    o.order_number = "ORD-2026-001"
    o.scheme = MaklonScheme.CMT
    o.target_quantity = 100
    o.status = status
    o.sample_version_id = None
    o.start_date = None
    o.deadline = None
    o.created_at = _NOW
    o.components = []
    return o


def _mock_component() -> MagicMock:
    c = MagicMock(spec=OrderComponent)
    c.id = _COMP_ID
    c.order_id = _ORDER_ID
    c.component_name = "Badan Depan"
    c.sequence_order = 1
    c.rate_card = None
    return c


# ===========================================================================
# SERVICE LAYER TESTS
# ===========================================================================

class TestCreateOrder:
    def test_creates_order_with_components(self) -> None:
        """Order baru harus berhasil dibuat dengan komponen dan rate card."""
        db = MagicMock(spec=Session)
        db.scalar.return_value = None  # no duplicate order_number, no sample version

        captured: list = []
        db.add.side_effect = captured.append

        payload = OrderCreate(
            client_id=_CLIENT_ID,
            order_number="ORD-NEW-001",
            scheme=MaklonScheme.CMT,
            target_quantity=200,
            components=[
                OrderComponentCreate(
                    component_name="Badan Depan",
                    sequence_order=1,
                    cutting_rate_per_pcs=Decimal("500"),
                    sewing_rate_per_pcs=Decimal("1500"),
                )
            ],
        )
        create_order(db, payload)

        # Harus ada: 1 Order + 1 OrderComponent + 1 RateCard = 3 objek
        types = [type(o).__name__ for o in captured]
        assert "Order" in types
        assert "OrderComponent" in types
        assert "RateCard" in types

    def test_duplicate_order_number_raises_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = MagicMock()  # order sudah ada

        payload = OrderCreate(
            client_id=_CLIENT_ID,
            order_number="ORD-DUPLIKAT",
            scheme=MaklonScheme.CMT,
            target_quantity=100,
        )
        with pytest.raises(OrderNumberDuplicateError):
            create_order(db, payload)

    def test_unapproved_sample_version_raises_error(self) -> None:
        """Versi sample yang belum APPROVED tidak boleh digunakan."""
        db = MagicMock(spec=Session)

        # scalar call 1: cek duplicate order_number → None
        # scalar call 2: ambil sample version → draft
        draft_version = MagicMock(spec=SampleVersion)
        draft_version.status = SampleStatus.DRAFT
        db.scalar.side_effect = [None, draft_version]

        payload = OrderCreate(
            client_id=_CLIENT_ID,
            order_number="ORD-SAMPLE-NEW",
            scheme=MaklonScheme.CMT,
            target_quantity=50,
            sample_version_id=_VERSION_ID,
        )
        with pytest.raises(SampleVersionNotApprovedError):
            create_order(db, payload)


class TestUpdateOrderStatus:
    def test_valid_transition_sample_to_cutting(self) -> None:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SAMPLE)
        db.scalar.return_value = order

        result = update_order_status(db, _ORDER_ID, OrderStatus.CUTTING)
        assert result.status == OrderStatus.CUTTING

    def test_valid_transition_cutting_to_sewing(self) -> None:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.CUTTING)
        db.scalar.return_value = order

        result = update_order_status(db, _ORDER_ID, OrderStatus.SEWING)
        assert result.status == OrderStatus.SEWING

    def test_invalid_skip_raises_error(self) -> None:
        """Tidak boleh melompat status, misal SAMPLE → SEWING."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SAMPLE)
        db.scalar.return_value = order

        with pytest.raises(OrderStatusTransitionError):
            update_order_status(db, _ORDER_ID, OrderStatus.SEWING)

    def test_backward_transition_raises_error(self) -> None:
        """Tidak boleh mundur status."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        db.scalar.return_value = order

        with pytest.raises(OrderStatusTransitionError):
            update_order_status(db, _ORDER_ID, OrderStatus.CUTTING)

    def test_order_not_found_raises_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        with pytest.raises(OrderNotFoundError):
            update_order_status(db, uuid.uuid4(), OrderStatus.CUTTING)


class TestRecordOutput:
    def test_records_output_in_sewing_status(self) -> None:
        """Output hanya bisa dicatat saat status SEWING."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        comp = _mock_component()

        # scalar: call 1 → order, call 2 → component
        db.scalar.side_effect = [order, comp]

        captured: list = []
        db.add.side_effect = captured.append

        payload = ProductionOutputCreate(
            order_id=_ORDER_ID,
            order_component_id=_COMP_ID,
            line_number=1,
            qty_completed=25,
            time_window=_NOW,
        )
        record_output(db, payload, operator_user_id=_USER_ID)

        out = captured[0]
        assert isinstance(out, ProductionOutput)
        assert out.qty_completed == 25
        assert out.is_verified is False
        assert out.operator_user_id == _USER_ID

    def test_non_sewing_status_blocks_output(self) -> None:
        """Order dengan status CUTTING tidak boleh menerima input output."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.CUTTING)
        db.scalar.return_value = order

        payload = ProductionOutputCreate(
            order_id=_ORDER_ID,
            order_component_id=_COMP_ID,
            line_number=1,
            qty_completed=10,
            time_window=_NOW,
        )
        with pytest.raises(OrderStatusTransitionError):
            record_output(db, payload, operator_user_id=_USER_ID)

    def test_wrong_component_raises_error(self) -> None:
        """Komponen yang bukan milik order harus ditolak."""
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        comp = _mock_component()
        comp.order_id = uuid.uuid4()  # bukan milik order ini

        db.scalar.side_effect = [order, comp]

        payload = ProductionOutputCreate(
            order_id=_ORDER_ID,
            order_component_id=_COMP_ID,
            line_number=1,
            qty_completed=10,
            time_window=_NOW,
        )
        with pytest.raises(ValueError):
            record_output(db, payload, operator_user_id=_USER_ID)


class TestVerifyOutput:
    def test_verifies_output_and_sets_mandor(self) -> None:
        db = MagicMock(spec=Session)
        out = MagicMock(spec=ProductionOutput)
        out.id = uuid.uuid4()
        out.is_verified = False
        out.verified_by_user_id = None
        db.scalar.return_value = out

        mandor_id = uuid.uuid4()
        result = verify_output(db, out.id, mandor_user_id=mandor_id)

        assert result.is_verified is True
        assert result.verified_by_user_id == mandor_id

    def test_output_not_found_raises_value_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        with pytest.raises(ValueError):
            verify_output(db, uuid.uuid4(), mandor_user_id=uuid.uuid4())


class TestGetOrderOutputSummary:
    def test_summary_calculates_correct_percentage(self) -> None:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        order.target_quantity = 100

        # scalars: 1 → order, 2 → total 60, 3 → verified 40
        db.scalar.side_effect = [order, 60, 40]

        summary = get_order_output_summary(db, _ORDER_ID)

        assert summary["total_completed"] == 60
        assert summary["verified_completed"] == 40
        assert summary["completion_pct"] == 60.0

    def test_zero_target_returns_zero_pct(self) -> None:
        db = MagicMock(spec=Session)
        order = _mock_order(OrderStatus.SEWING)
        order.target_quantity = 0
        db.scalar.side_effect = [order, 0, 0]

        summary = get_order_output_summary(db, _ORDER_ID)
        assert summary["completion_pct"] == 0.0


class TestWorkerDashboardSummary:
    def test_only_counts_latest_qc_result_per_worker_output(self) -> None:
        db = MagicMock(spec=Session)
        second_output_id = uuid.uuid4()
        order = SimpleNamespace(
            id=_ORDER_ID,
            order_number="ORD-2026-001",
            status=OrderStatus.SEWING,
            target_quantity=100,
            start_date=_NOW,
            deadline=None,
        )
        outputs = [
            SimpleNamespace(
                id=_COMP_ID,
                order_id=_ORDER_ID,
                order=order,
                qty_completed=10,
                is_verified=True,
            ),
            SimpleNamespace(
                id=second_output_id,
                order_id=_ORDER_ID,
                order=order,
                qty_completed=5,
                is_verified=False,
            ),
        ]
        inspections = [
            SimpleNamespace(
                production_output_id=_COMP_ID,
                order_id=uuid.uuid4(),
                status=QCStatus.LOLOS,
                qty_inspected=99,
            ),
            SimpleNamespace(
                production_output_id=_COMP_ID,
                order_id=_ORDER_ID,
                status=QCStatus.DEFECT,
                qty_inspected=2,
            ),
            SimpleNamespace(
                production_output_id=_COMP_ID,
                order_id=_ORDER_ID,
                status=QCStatus.LOLOS,
                qty_inspected=10,
            ),
            SimpleNamespace(
                production_output_id=second_output_id,
                order_id=_ORDER_ID,
                status=QCStatus.REPAIR,
                qty_inspected=3,
            ),
        ]
        output_result = MagicMock()
        output_result.all.return_value = outputs
        inspection_result = MagicMock()
        inspection_result.all.return_value = inspections
        db.scalars.side_effect = [output_result, inspection_result]
        db.scalar.return_value = 0

        summary = get_worker_dashboard_summary(db, _USER_ID)

        assert summary.total_output_qty == 15
        assert summary.verified_output_qty == 10
        assert summary.qc_passed_qty == 0
        assert summary.qc_repair_qty == 3
        assert summary.qc_defect_qty == 2
        assert summary.unattributed_qc_inspections == 0
        assert len(summary.orders) == 1


# ===========================================================================
# HTTP / ENDPOINT TESTS
# ===========================================================================

_MOCK_MANDOR = User(
    id=_USER_ID,
    username="mandor_agus",
    role=UserRole.MANDOR,
    client_id=None,
    hashed_password="x",
    name="Mandor Agus",
)

_MOCK_PENJAHIT = User(
    id=uuid.uuid4(),
    username="penjahit_siti",
    role=UserRole.PENJAHIT,
    client_id=None,
    hashed_password="x",
    name="Siti",
)


def _mandor_user() -> User:
    return _MOCK_MANDOR


class TestProduksiEndpoints:
    def _client_with_overrides(self, user_fn=None) -> TestClient:
        from app.modules.auth.dependencies import get_current_user, require_roles

        app.dependency_overrides[get_current_user] = user_fn or _mandor_user
        app.dependency_overrides[require_roles] = lambda roles: lambda: None  # type: ignore[assignment]
        return TestClient(app, raise_server_exceptions=False)

    def teardown_method(self) -> None:
        app.dependency_overrides.clear()

    @patch("app.modules.produksi.router.list_orders")
    def test_get_orders_returns_200(self, mock_list: MagicMock) -> None:
        mock_list.return_value = []
        client = self._client_with_overrides()
        resp = client.get("/api/v1/produksi/orders")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.modules.produksi.router.list_worker_orders")
    def test_tailor_order_list_is_scoped_to_own_outputs(self, mock_list: MagicMock) -> None:
        mock_list.return_value = []
        client = self._client_with_overrides(user_fn=lambda: _MOCK_PENJAHIT)

        response = client.get("/api/v1/produksi/orders")

        assert response.status_code == 200
        mock_list.assert_called_once()

    @patch("app.modules.produksi.router.worker_has_output_for_order", return_value=False)
    def test_tailor_cannot_read_unassigned_order(self, _mock_has_output: MagicMock) -> None:
        client = self._client_with_overrides(user_fn=lambda: _MOCK_PENJAHIT)

        response = client.get(f"/api/v1/produksi/orders/{_ORDER_ID}")

        assert response.status_code == 404

    @patch("app.modules.produksi.router.worker_has_output_for_order", return_value=False)
    def test_tailor_cannot_read_unassigned_order_summary(self, _mock_has_output: MagicMock) -> None:
        client = self._client_with_overrides(user_fn=lambda: _MOCK_PENJAHIT)

        response = client.get(f"/api/v1/produksi/orders/{_ORDER_ID}/summary")

        assert response.status_code == 404

    @patch("app.modules.produksi.router.get_worker_dashboard_summary")
    def test_worker_dashboard_is_available_to_seamstress(
        self, mock_dashboard: MagicMock
    ) -> None:
        mock_dashboard.return_value = {
            "total_output_qty": 0,
            "verified_output_qty": 0,
            "qc_passed_qty": 0,
            "qc_repair_qty": 0,
            "qc_defect_qty": 0,
            "unattributed_qc_inspections": 0,
            "orders": [],
        }
        client = self._client_with_overrides(user_fn=lambda: _MOCK_PENJAHIT)

        response = client.get("/api/v1/produksi/my-dashboard")

        assert response.status_code == 200
        assert response.json()["orders"] == []
        mock_dashboard.assert_called_once()

    def test_worker_dashboard_rejects_other_roles(self) -> None:
        from app.modules.auth.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _mandor_user
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/api/v1/produksi/my-dashboard")

        assert response.status_code == 403

    @patch("app.modules.produksi.router.create_order")
    def test_post_order_returns_201(self, mock_create: MagicMock) -> None:
        mock_order = _mock_order()
        mock_order.components = []
        mock_create.return_value = mock_order

        client = self._client_with_overrides()
        resp = client.post(
            "/api/v1/produksi/orders",
            json={
                "client_id": str(_CLIENT_ID),
                "order_number": "ORD-TEST-001",
                "scheme": "CMT",
                "target_quantity": 100,
                "components": [],
            },
        )
        assert resp.status_code == 201

    @patch("app.modules.produksi.router.create_order")
    def test_post_order_duplicate_returns_409(self, mock_create: MagicMock) -> None:
        mock_create.side_effect = OrderNumberDuplicateError("ORD-TEST-001")
        client = self._client_with_overrides()
        resp = client.post(
            "/api/v1/produksi/orders",
            json={
                "client_id": str(_CLIENT_ID),
                "order_number": "ORD-TEST-001",
                "scheme": "CMT",
                "target_quantity": 100,
            },
        )
        assert resp.status_code == 409

    @patch("app.modules.produksi.router.update_order_status")
    def test_patch_status_invalid_transition_returns_422(self, mock_update: MagicMock) -> None:
        mock_update.side_effect = OrderStatusTransitionError("SAMPLE", "SEWING")
        client = self._client_with_overrides()
        resp = client.patch(
            f"/api/v1/produksi/orders/{_ORDER_ID}/status",
            json={"status": "SEWING"},
        )
        assert resp.status_code == 422

    @patch("app.modules.produksi.router.record_output")
    def test_post_output_wrong_status_returns_422(self, mock_record: MagicMock) -> None:
        mock_record.side_effect = OrderStatusTransitionError(
            "CUTTING", "SEWING (order harus dalam status SEWING untuk mencatat output)"
        )
        client = self._client_with_overrides()
        resp = client.post(
            "/api/v1/produksi/outputs",
            json={
                "order_id": str(_ORDER_ID),
                "order_component_id": str(_COMP_ID),
                "line_number": 1,
                "qty_completed": 10,
                "time_window": _NOW.isoformat(),
            },
        )
        assert resp.status_code == 422

    @patch("app.modules.produksi.router.create_order_from_sample")
    def test_convert_sample_not_approved_returns_409(self, mock_conv: MagicMock) -> None:
        mock_conv.side_effect = SampleVersionNotApprovedError(_VERSION_ID)
        # Gunakan OWNER user agar punya akses ke endpoint from-sample
        owner = User(
            id=uuid.uuid4(), username="owner", role=UserRole.OWNER,
            client_id=None, hashed_password="x", name="Owner",
        )
        client = self._client_with_overrides(user_fn=lambda: owner)
        resp = client.post(
            f"/api/v1/produksi/orders/from-sample/{_VERSION_ID}",
            json={
                "order_number": "ORD-CONV-001",
                "scheme": "CMT",
                "target_quantity": 50,
                "cutting_rate_per_pcs": "500.00",
                "sewing_rate_per_pcs": "1500.00",
            },
        )
        assert resp.status_code == 409

    @patch("app.modules.produksi.router.get_order")
    @patch("app.modules.produksi.router.get_order_output_summary")
    def test_get_order_summary_returns_200(self, mock_summary: MagicMock, mock_get: MagicMock) -> None:
        mock_get.return_value = MagicMock(client_id=None)
        mock_summary.return_value = {
            "order_id": _ORDER_ID,
            "order_number": "ORD-2026-001",
            "target_quantity": 100,
            "total_completed": 60,
            "verified_completed": 40,
            "completion_pct": 60.0,
        }
        client = self._client_with_overrides()
        resp = client.get(f"/api/v1/produksi/orders/{_ORDER_ID}/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["completion_pct"] == 60.0
        assert data["total_completed"] == 60
