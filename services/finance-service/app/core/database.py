"""Koneksi SQLAlchemy dan dependency session untuk setiap request."""
from collections.abc import Iterator
from typing import Union

import sqlalchemy.util.typing as sa_typing
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Kompatibilitas Python 3.14 dengan SQLAlchemy 2.0.36 make_union_type
sa_typing.make_union_type = lambda *types: Union[types] if len(types) > 1 else types[0]

from app.core.config import get_settings  # noqa: E402


class Base(DeclarativeBase):
    """Base class untuk semua model ORM. Setiap modul mendefinisikan model di folder-nya."""


settings = get_settings()

# pool_pre_ping memastikan koneksi yang sudah putus tidak dipakai ulang
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Memberi session database ke endpoint dan menutupnya setelah request selesai."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
