"""Fixture bersama untuk pengujian API. Database asli tidak wajib berjalan saat tes."""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app


class FakeSession:
    """Session pengganti. `fail=True` mensimulasikan database yang mati."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def execute(self, *args, **kwargs):
        if self.fail:
            raise RuntimeError("database tidak tersedia")
        return None


@pytest.fixture
def client() -> Iterator[TestClient]:
    def _ok_db():
        yield FakeSession()

    app.dependency_overrides[get_db] = _ok_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_db_down() -> Iterator[TestClient]:
    def _down_db():
        yield FakeSession(fail=True)

    app.dependency_overrides[get_db] = _down_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
