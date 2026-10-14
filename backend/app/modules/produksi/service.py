"""Logika bisnis Produksi, Order Massal, dan Terminal Input 30 Menit (FR-7, FR-8, FR-9).

Alur Utama:
  1. Buat Order baru (langsung atau dari versi sample APPROVED — FR-4.1).
  2. Tambahkan komponen + rate card upah borongan.
  3. Perbarui status order sesuai alur: SAMPLE→CUTTING→SEWING→MENUNGGU_QC→QC→COMPLETED.
  4. Penjahit mencatat output per 30 menit lewat terminal tablet (POST /produksi/outputs).
  5. Mandor memverifikasi setiap log output (PATCH /produksi/outputs/{id}/verify).
"""
import uuid
from decimal import Decimal

from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import Session, selectinload

from app.modules.produksi.errors import (
    InvalidOutputQuantityError,
    OrderComponentNotFoundError,
    OrderNotFoundError,
    OrderNumberDuplicateError,
    OrderStatusTransitionError,
    SampleVersionNotApprovedError,
)
from app.modules.produksi.models import (
    MaklonScheme,
    Order,
    OrderComponent,
    OrderStatus,
    ProductionOutput,
    RateCard,
)
from app.modules.produksi.schemas import (
    OrderComponentCreate,
    OrderCreate,
    OrderFromSampleCreate,
    ProductionOutputCreate,
)
from app.modules.sample.models import SampleComponent, SampleStatus, SampleVersion

# Urutan status yang sah untuk transisi maju
_STATUS_ORDER = [
    OrderStatus.SAMPLE,
    OrderStatus.CUTTING,
    OrderStatus.SEWING,
    OrderStatus.MENUNGGU_QC,
    OrderStatus.QC,
    OrderStatus.COMPLETED,
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_raise_order(db: Session, order_id: uuid.UUID) -> Order:
    o = db.scalar(select(Order).where(Order.id == order_id))
    if o is None:
        raise OrderNotFoundError(order_id)
    return o


def _get_or_raise_component(db: Session, component_id: uuid.UUID) -> OrderComponent:
    c = db.scalar(select(OrderComponent).where(OrderComponent.id == component_id))
    if c is None:
        raise OrderComponentNotFoundError(component_id)
    return c


def _create_component_with_rate(
    db: Session,
    order_id: uuid.UUID,
    comp_data: OrderComponentCreate,
) -> OrderComponent:
    comp = OrderComponent(
        order_id=order_id,
        component_name=comp_data.component_name.strip(),
        sequence_order=comp_data.sequence_order,
    )
    db.add(comp)
    db.flush()

    rate = RateCard(
        order_component_id=comp.id,
        cutting_rate_per_pcs=comp_data.cutting_rate_per_pcs,
        sewing_rate_per_pcs=comp_data.sewing_rate_per_pcs,
    )
    db.add(rate)
    return comp


# ---------------------------------------------------------------------------
# Order CRUD
# ---------------------------------------------------------------------------

def list_orders(
    db: Session,
    client_id: uuid.UUID | None = None,
    status: OrderStatus | None = None,
) -> list[Order]:
    stmt = (
        select(Order)
        .options(selectinload(Order.components).selectinload(OrderComponent.rate_card))
        .order_by(Order.created_at.desc())
    )
    if client_id is not None:
        stmt = stmt.where(Order.client_id == client_id)
    if status is not None:
        stmt = stmt.where(Order.status == status)
    return list(db.scalars(stmt).all())


def get_order(db: Session, order_id: uuid.UUID) -> Order:
    o = db.scalar(
        select(Order)
        .options(selectinload(Order.components).selectinload(OrderComponent.rate_card))
        .where(Order.id == order_id)
    )
    if o is None:
        raise OrderNotFoundError(order_id)
    return o


def create_order(db: Session, payload: OrderCreate) -> Order:
    """Membuat Order Produksi Massal baru beserta komponen dan rate card.

    Jika sample_version_id diberikan, pastikan versinya APPROVED.
    """
    # Cek duplikat nomor order
    if db.scalar(select(Order).where(Order.order_number == payload.order_number.strip().upper())):
        raise OrderNumberDuplicateError(payload.order_number)

    # Validasi sample version jika diberikan
    if payload.sample_version_id:
        sv = db.scalar(select(SampleVersion).where(SampleVersion.id == payload.sample_version_id))
        if sv and sv.status != SampleStatus.APPROVED:
            raise SampleVersionNotApprovedError(payload.sample_version_id)

    order = Order(
        client_id=payload.client_id,
        order_number=payload.order_number.strip().upper(),
        scheme=payload.scheme,
        target_quantity=payload.target_quantity,
        sample_version_id=payload.sample_version_id,
        status=OrderStatus.SAMPLE,
        start_date=payload.start_date,
        deadline=payload.deadline,
    )
    db.add(order)
    db.flush()

    for comp_data in payload.components:
        _create_component_with_rate(db, order.id, comp_data)

    db.commit()
    db.refresh(order)
    return order


def create_order_from_sample(
    db: Session,
    version_id: uuid.UUID,
    payload: OrderFromSampleCreate,
) -> Order:
    """FR-4.1: Konversi versi sample APPROVED menjadi Order Produksi Massal.

    Komponen diambil otomatis dari SampleComponent yang terdaftar di versi tersebut.
    Rate card dapat dioverride lewat payload.
    """
    sv = db.scalar(
        select(SampleVersion)
        .options(selectinload(SampleVersion.components))
        .where(SampleVersion.id == version_id)
    )
    if sv is None:
        raise ValueError(f"Versi sample {version_id} tidak ditemukan.")
    if sv.status != SampleStatus.APPROVED:
        raise SampleVersionNotApprovedError(version_id)

    # Cek duplikat nomor order
    if db.scalar(select(Order).where(Order.order_number == payload.order_number.strip().upper())):
        raise OrderNumberDuplicateError(payload.order_number)

    # Ambil client_id dari sample parent
    sample = sv.sample
    order = Order(
        client_id=sample.client_id,
        order_number=payload.order_number.strip().upper(),
        scheme=payload.scheme,
        target_quantity=payload.target_quantity,
        sample_version_id=version_id,
        status=OrderStatus.CUTTING,  # Langsung mulai cutting setelah sample approved
        start_date=payload.start_date,
        deadline=payload.deadline,
    )
    db.add(order)
    db.flush()

    # Buat komponen dari SampleComponent
    for i, sc in enumerate(sv.components, start=1):
        comp = OrderComponent(
            order_id=order.id,
            component_name=sc.component_name,
            sequence_order=i,
        )
        db.add(comp)
        db.flush()
        rate = RateCard(
            order_component_id=comp.id,
            cutting_rate_per_pcs=payload.cutting_rate_per_pcs,
            sewing_rate_per_pcs=payload.sewing_rate_per_pcs,
        )
        db.add(rate)

    db.commit()
    db.refresh(order)
    return order


def update_order_status(db: Session, order_id: uuid.UUID, new_status: OrderStatus) -> Order:
    """Memajukan status order satu langkah ke depan dalam alur produksi.

    Alur wajib: SAMPLE → CUTTING → SEWING → MENUNGGU_QC → QC → COMPLETED.
    Tidak bisa melompat atau mundur.
    """
    order = _get_or_raise_order(db, order_id)
    current_idx = _STATUS_ORDER.index(order.status)
    target_idx = _STATUS_ORDER.index(new_status)

    if target_idx != current_idx + 1:
        raise OrderStatusTransitionError(order.status.value, new_status.value)

    order.status = new_status
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# ProductionOutput (Terminal 30 Menit)
# ---------------------------------------------------------------------------

def list_outputs(
    db: Session,
    order_id: uuid.UUID | None = None,
    operator_user_id: uuid.UUID | None = None,
    line_number: int | None = None,
    is_verified: bool | None = None,
) -> list[ProductionOutput]:
    """Mengambil log output 30 menit, dengan berbagai filter opsional."""
    stmt = select(ProductionOutput).order_by(ProductionOutput.time_window.desc())
    if order_id is not None:
        stmt = stmt.where(ProductionOutput.order_id == order_id)
    if operator_user_id is not None:
        stmt = stmt.where(ProductionOutput.operator_user_id == operator_user_id)
    if line_number is not None:
        stmt = stmt.where(ProductionOutput.line_number == line_number)
    if is_verified is not None:
        stmt = stmt.where(ProductionOutput.is_verified == is_verified)
    return list(db.scalars(stmt).all())


def record_output(
    db: Session,
    payload: ProductionOutputCreate,
    operator_user_id: uuid.UUID,
) -> ProductionOutput:
    """Mencatat output penjahit dari terminal tablet per interval 30 menit (FR-8).

    Validasi:
    - Order harus ada dan statusnya SEWING.
    - Komponen harus milik order tersebut.
    - qty_completed > 0.
    """
    order = _get_or_raise_order(db, payload.order_id)
    if order.status != OrderStatus.SEWING:
        raise OrderStatusTransitionError(
            order.status.value, "SEWING (order harus dalam status SEWING untuk mencatat output)"
        )

    comp = _get_or_raise_component(db, payload.order_component_id)
    if comp.order_id != payload.order_id:
        raise ValueError(
            f"Komponen {payload.order_component_id} bukan milik order {payload.order_id}."
        )

    if payload.qty_completed <= 0:
        raise InvalidOutputQuantityError(payload.qty_completed)

    output = ProductionOutput(
        order_id=payload.order_id,
        order_component_id=payload.order_component_id,
        operator_user_id=operator_user_id,
        line_number=payload.line_number,
        qty_completed=payload.qty_completed,
        time_window=payload.time_window,
        is_verified=False,
    )
    db.add(output)
    db.commit()
    db.refresh(output)
    return output


def verify_output(
    db: Session,
    output_id: uuid.UUID,
    mandor_user_id: uuid.UUID,
) -> ProductionOutput:
    """Verifikasi log output 30 menit oleh Mandor (FR-8)."""
    out = db.scalar(select(ProductionOutput).where(ProductionOutput.id == output_id))
    if out is None:
        raise ValueError(f"Output dengan ID {output_id} tidak ditemukan.")
    out.is_verified = True
    out.verified_by_user_id = mandor_user_id
    db.commit()
    db.refresh(out)
    return out


def get_order_output_summary(db: Session, order_id: uuid.UUID) -> dict:
    """Ringkasan total output vs target untuk sebuah order."""
    order = _get_or_raise_order(db, order_id)

    total = db.scalar(
        select(sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0))
        .where(ProductionOutput.order_id == order_id)
    ) or 0

    verified = db.scalar(
        select(sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0))
        .where(ProductionOutput.order_id == order_id, ProductionOutput.is_verified.is_(True))
    ) or 0

    pct = round((int(total) / order.target_quantity) * 100, 2) if order.target_quantity else 0.0

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "target_quantity": order.target_quantity,
        "total_completed": int(total),
        "verified_completed": int(verified),
        "completion_pct": pct,
    }
