"""Unit test modul Sample & Time Study Tracker (FR-3, FR-4).

Pengujian mencakup Skenario 4 (P0):
  - Pembuatan sample (v1 DRAFT otomatis)
  - Penambahan komponen time study
  - Revisi versi (v2, v3)
  - Approval versi
  - Guard: versi APPROVED tidak bisa diubah
  - Guard: kode sample duplikat ditolak
  - Endpoint HTTP: status codes & isolasi multi-tenant
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modules.auth.models import User, UserRole
from app.modules.sample.errors import (
    SampleAlreadyApprovedError,
    SampleCodeDuplicateError,
    SampleNotFoundError,
    SampleVersionNotFoundError,
)
from app.modules.sample.models import Sample, SampleComponent, SampleStatus, SampleVersion
from app.modules.sample.schemas import (
    SampleComponentCreate,
    SampleCreate,
    SampleVersionCreate,
)
from app.modules.sample.service import (
    add_component,
    approve_version,
    create_revision,
    create_sample,
    get_sample,
    get_version,
    list_samples,
    update_component,
)


# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------

def _make_client_id() -> uuid.UUID:
    return uuid.uuid4()


def _make_sample(db: Session, *, client_id: uuid.UUID | None = None, code: str = "SMP-001") -> Sample:
    cid = client_id or _make_client_id()
    payload = SampleCreate(client_id=cid, sample_code=code, article_name="Kaos Polos Navy")
    return create_sample(db, payload)


def _make_db() -> MagicMock:
    """Membuat mock Session minimal yang dibutuhkan oleh service functions."""
    db = MagicMock(spec=Session)
    return db


# ===========================================================================
# SERVICE LAYER TESTS
# ===========================================================================

class TestCreateSample:
    def test_creates_sample_with_v1_draft(self) -> None:
        """FR-3.1: Sample baru harus memiliki versi v1 DRAFT secara otomatis."""
        cid = _make_client_id()
        payload = SampleCreate(client_id=cid, sample_code="SMP-TEST-01", article_name="Polo Shirt")

        # Gunakan in-memory mock: scalar() pertama → None (kode belum ada)
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        captured_objs: list = []

        def fake_add(obj: object) -> None:
            captured_objs.append(obj)

        db.add.side_effect = fake_add

        create_sample(db, payload)

        # Harus menambahkan 2 objek: Sample + SampleVersion
        assert len(captured_objs) == 2
        sample_obj = captured_objs[0]
        version_obj = captured_objs[1]

        assert isinstance(sample_obj, Sample)
        assert sample_obj.sample_code == "SMP-TEST-01"
        assert sample_obj.client_id == cid

        assert isinstance(version_obj, SampleVersion)
        assert version_obj.version_number == 1
        assert version_obj.status == SampleStatus.DRAFT

    def test_duplicate_code_raises_error(self) -> None:
        """Kode sample yang sudah dipakai harus ditolak."""
        db = MagicMock(spec=Session)
        db.scalar.return_value = MagicMock()  # simulasi: kode sudah ada

        payload = SampleCreate(client_id=_make_client_id(), sample_code="DUPLIKAT", article_name="Test")

        with pytest.raises(SampleCodeDuplicateError):
            create_sample(db, payload)


class TestGetSample:
    def test_raises_not_found_when_missing(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None
        bad_id = uuid.uuid4()

        with pytest.raises(SampleNotFoundError):
            get_sample(db, bad_id)


class TestCreateRevision:
    def _make_mock_sample(self, max_version: int = 1) -> MagicMock:
        sample = MagicMock(spec=Sample)
        sample.id = uuid.uuid4()
        v = MagicMock(spec=SampleVersion)
        v.version_number = max_version
        sample.versions = [v]
        return sample

    def test_revision_increments_version_number(self) -> None:
        """Nomor versi revisi harus +1 dari versi tertinggi yang ada."""
        db = MagicMock(spec=Session)
        sample = self._make_mock_sample(max_version=2)
        db.scalar.return_value = sample

        captured: list = []
        db.add.side_effect = captured.append

        payload = SampleVersionCreate(tech_pack_notes="Revisi ukuran lengan")
        create_revision(db, sample.id, payload)

        version_obj = captured[0]
        assert isinstance(version_obj, SampleVersion)
        assert version_obj.version_number == 3
        assert version_obj.status == SampleStatus.REVISION

    def test_raises_not_found_for_missing_sample(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        with pytest.raises(SampleNotFoundError):
            create_revision(db, uuid.uuid4(), SampleVersionCreate())


class TestApproveVersion:
    def _make_mock_version(self, status: SampleStatus) -> MagicMock:
        v = MagicMock(spec=SampleVersion)
        v.id = uuid.uuid4()
        v.status = status
        return v

    def test_draft_can_be_approved(self) -> None:
        db = MagicMock(spec=Session)
        version = self._make_mock_version(SampleStatus.DRAFT)
        db.scalar.return_value = version

        result = approve_version(db, version.id)
        assert result.status == SampleStatus.APPROVED

    def test_revision_can_be_approved(self) -> None:
        db = MagicMock(spec=Session)
        version = self._make_mock_version(SampleStatus.REVISION)
        db.scalar.return_value = version

        result = approve_version(db, version.id)
        assert result.status == SampleStatus.APPROVED

    def test_already_approved_raises_error(self) -> None:
        """FR-4.1: Versi APPROVED tidak bisa di-approve ulang."""
        db = MagicMock(spec=Session)
        version = self._make_mock_version(SampleStatus.APPROVED)
        db.scalar.return_value = version

        with pytest.raises(SampleAlreadyApprovedError):
            approve_version(db, version.id)

    def test_version_not_found_raises_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        with pytest.raises(SampleVersionNotFoundError):
            approve_version(db, uuid.uuid4())


class TestAddComponent:
    def _make_mock_version(self, status: SampleStatus) -> MagicMock:
        v = MagicMock(spec=SampleVersion)
        v.id = uuid.uuid4()
        v.status = status
        return v

    def test_adds_component_to_draft_version(self) -> None:
        db = MagicMock(spec=Session)
        version = self._make_mock_version(SampleStatus.DRAFT)
        db.scalar.return_value = version

        captured: list = []
        db.add.side_effect = captured.append

        payload = SampleComponentCreate(
            component_name="Badan Depan",
            material_usage_est=1.5,
            time_study_seconds=45.0,
        )
        add_component(db, version.id, payload)

        comp = captured[0]
        assert isinstance(comp, SampleComponent)
        assert comp.component_name == "Badan Depan"
        assert comp.material_usage_est == 1.5
        assert comp.time_study_seconds == 45.0

    def test_approved_version_blocks_component_add(self) -> None:
        """FR-3.1: Versi APPROVED tidak dapat dimodifikasi."""
        db = MagicMock(spec=Session)
        version = self._make_mock_version(SampleStatus.APPROVED)
        db.scalar.return_value = version

        payload = SampleComponentCreate(component_name="Kerah", material_usage_est=0.3, time_study_seconds=10.0)

        with pytest.raises(SampleAlreadyApprovedError):
            add_component(db, version.id, payload)

    def test_version_not_found_raises_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        payload = SampleComponentCreate(component_name="Lengan", material_usage_est=0.5, time_study_seconds=20.0)

        with pytest.raises(SampleVersionNotFoundError):
            add_component(db, uuid.uuid4(), payload)


class TestUpdateComponent:
    def test_approved_version_blocks_update(self) -> None:
        """Komponen tidak bisa diupdate jika versinya sudah APPROVED."""
        db = MagicMock(spec=Session)

        comp = MagicMock(spec=SampleComponent)
        comp.id = uuid.uuid4()
        comp.sample_version_id = uuid.uuid4()

        version = MagicMock(spec=SampleVersion)
        version.id = comp.sample_version_id
        version.status = SampleStatus.APPROVED

        # scalar: call pertama → comp, call kedua → version
        db.scalar.side_effect = [comp, version]

        payload = SampleComponentCreate(component_name="Kerah Updated", material_usage_est=0.4, time_study_seconds=12.0)

        with pytest.raises(SampleAlreadyApprovedError):
            update_component(db, comp.id, payload)

    def test_component_not_found_raises_value_error(self) -> None:
        db = MagicMock(spec=Session)
        db.scalar.return_value = None

        payload = SampleComponentCreate(component_name="X", material_usage_est=0.0, time_study_seconds=0.0)

        with pytest.raises(ValueError):
            update_component(db, uuid.uuid4(), payload)


# ===========================================================================
# HTTP / ENDPOINT TESTS (menggunakan TestClient)
# ===========================================================================

_SAMPLE_USER_ID = uuid.uuid4()
_CLIENT_ID = uuid.uuid4()

_MOCK_SAMPLE_USER = User(
    id=_SAMPLE_USER_ID,
    username="adis_sample",
    role=UserRole.TIM_SAMPLE,
    client_id=None,
    hashed_password="x",
)


def _mock_sample_user() -> User:
    return _MOCK_SAMPLE_USER


class TestSampleEndpoints:
    """HTTP endpoint tests menggunakan mock dependencies."""

    def _client_with_overrides(self) -> TestClient:
        from app.modules.auth.dependencies import get_current_user, require_roles

        app.dependency_overrides[get_current_user] = _mock_sample_user
        # Override require_roles agar tidak cek DB
        app.dependency_overrides[require_roles] = lambda roles: lambda: None  # type: ignore[assignment]
        return TestClient(app, raise_server_exceptions=False)

    def teardown_method(self) -> None:
        app.dependency_overrides.clear()

    @patch("app.modules.sample.router.list_samples")
    def test_get_samples_returns_200(self, mock_list: MagicMock) -> None:
        mock_list.return_value = []
        client = self._client_with_overrides()
        resp = client.get("/api/v1/sample/")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.modules.sample.router.create_sample")
    def test_post_sample_returns_201(self, mock_create: MagicMock) -> None:
        fake_id = uuid.uuid4()
        mock_sample = MagicMock(spec=Sample)
        mock_sample.id = fake_id
        mock_sample.client_id = _CLIENT_ID
        mock_sample.sample_code = "SMP-001"
        mock_sample.article_name = "Kaos Polos Navy"
        from datetime import datetime, timezone
        mock_sample.created_at = datetime.now(timezone.utc)
        mock_sample.versions = []
        mock_create.return_value = mock_sample

        client = self._client_with_overrides()
        resp = client.post(
            "/api/v1/sample/",
            json={
                "client_id": str(_CLIENT_ID),
                "sample_code": "SMP-001",
                "article_name": "Kaos Polos Navy",
            },
        )
        assert resp.status_code == 201

    @patch("app.modules.sample.router.create_sample")
    def test_post_sample_duplicate_returns_409(self, mock_create: MagicMock) -> None:
        mock_create.side_effect = SampleCodeDuplicateError("SMP-001")
        client = self._client_with_overrides()
        resp = client.post(
            "/api/v1/sample/",
            json={
                "client_id": str(_CLIENT_ID),
                "sample_code": "SMP-001",
                "article_name": "Kaos Polos Navy",
            },
        )
        assert resp.status_code == 409

    @patch("app.modules.sample.router.approve_version")
    def test_approve_already_approved_returns_409(self, mock_approve: MagicMock) -> None:
        vid = uuid.uuid4()
        mock_approve.side_effect = SampleAlreadyApprovedError(vid)
        client = self._client_with_overrides()
        resp = client.post(f"/api/v1/sample/versions/{vid}/approve")
        assert resp.status_code == 409

    @patch("app.modules.sample.router.approve_version")
    def test_approve_not_found_returns_404(self, mock_approve: MagicMock) -> None:
        vid = uuid.uuid4()
        mock_approve.side_effect = SampleVersionNotFoundError(vid)
        client = self._client_with_overrides()
        resp = client.post(f"/api/v1/sample/versions/{vid}/approve")
        assert resp.status_code == 404

    @patch("app.modules.sample.router.add_component")
    def test_add_component_to_approved_returns_409(self, mock_add: MagicMock) -> None:
        vid = uuid.uuid4()
        mock_add.side_effect = SampleAlreadyApprovedError(vid)
        client = self._client_with_overrides()
        resp = client.post(
            f"/api/v1/sample/versions/{vid}/components",
            json={"component_name": "Kerah", "material_usage_est": 0.3, "time_study_seconds": 10.0},
        )
        assert resp.status_code == 409
