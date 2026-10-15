"""Logika bisnis Produksi, Order Massal, dan Terminal Input 30 Menit (FR-7, FR-8, FR-9).

Alur Utama:
  1. Buat Order baru (langsung atau dari versi sample OWNER_APPROVED — FR-4.1).
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
from app.modules.qc.models import QCInspection, QCStatus
from app.modules.produksi.schemas import (
    OrderComponentCreate,
    OrderCreate,
    OrderFromSampleCreate,
    ProductionOutputCreate,
    WorkerDashboardOrderResponse,
    WorkerDashboardResponse,
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


def list_worker_orders(
    db: Session,
    operator_user_id: uuid.UUID,
    status: OrderStatus | None = None,
) -> list[Order]:
    """Ambil hanya order yang pernah memiliki output dari Penjahit."""
    stmt = (
        select(Order)
        .join(ProductionOutput, ProductionOutput.order_id == Order.id)
        .options(selectinload(Order.components).selectinload(OrderComponent.rate_card))
        .where(ProductionOutput.operator_user_id == operator_user_id)
        .distinct()
        .order_by(Order.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Order.status == status)
    return list(db.scalars(stmt).all())


def worker_has_output_for_order(
    db: Session,
    operator_user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> bool:
    return db.scalar(
        select(ProductionOutput.id)
        .where(
            ProductionOutput.operator_user_id == operator_user_id,
            ProductionOutput.order_id == order_id,
        )
        .limit(1)
    ) is not None


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

    Jika sample_version_id diberikan, versinya wajib OWNER_APPROVED
    (lolos tim sample + disetujui owner beserta harga).
    """
    # Cek duplikat nomor order
    if db.scalar(select(Order).where(Order.order_number == payload.order_number.strip().upper())):
        raise OrderNumberDuplicateError(payload.order_number)

    # Validasi sample version jika diberikan
    if payload.sample_version_id:
        sv = db.scalar(select(SampleVersion).where(SampleVersion.id == payload.sample_version_id))
        if sv and sv.status != SampleStatus.OWNER_APPROVED:
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
    """FR-4.1: Konversi versi sample OWNER_APPROVED menjadi Order Produksi Massal.

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
    if sv.status != SampleStatus.OWNER_APPROVED:
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


def update_rate_card(
    db: Session,
    component_id: uuid.UUID,
    cutting_rate_per_pcs: Decimal,
    sewing_rate_per_pcs: Decimal,
    changed_by_id: uuid.UUID | None = None,
) -> Order:
    """Ubah rate card upah borongan sebuah komponen (matriks: OWNER & MANDOR).

    Membuat RateCard jika belum ada. Setiap perubahan dicatat ke riwayat (FR-7.2).
    Mengembalikan order lengkap untuk response.
    """
    from app.modules.gudang.models import RateCardChange

    comp = _get_or_raise_component(db, component_id)
    rate = db.scalar(select(RateCard).where(RateCard.order_component_id == comp.id))
    if rate is None:
        rate = RateCard(
            order_component_id=comp.id,
            cutting_rate_per_pcs=cutting_rate_per_pcs,
            sewing_rate_per_pcs=sewing_rate_per_pcs,
        )
        db.add(rate)
        db.flush()
        db.add(
            RateCardChange(
                order_component_id=comp.id,
                old_cutting_rate=0.0,
                old_sewing_rate=0.0,
                new_cutting_rate=float(cutting_rate_per_pcs),
                new_sewing_rate=float(sewing_rate_per_pcs),
                changed_by_user_id=changed_by_id,
            )
        )
    else:
        if (Decimal(str(rate.cutting_rate_per_pcs)) != Decimal(str(cutting_rate_per_pcs))
                or Decimal(str(rate.sewing_rate_per_pcs)) != Decimal(str(sewing_rate_per_pcs))):
            db.add(
                RateCardChange(
                    order_component_id=comp.id,
                    old_cutting_rate=float(rate.cutting_rate_per_pcs),
                    old_sewing_rate=float(rate.sewing_rate_per_pcs),
                    new_cutting_rate=float(cutting_rate_per_pcs),
                    new_sewing_rate=float(sewing_rate_per_pcs),
                    changed_by_user_id=changed_by_id,
                )
            )
        rate.cutting_rate_per_pcs = cutting_rate_per_pcs
        rate.sewing_rate_per_pcs = sewing_rate_per_pcs
    db.commit()
    return get_order(db, comp.order_id)


def list_rate_history(db: Session, component_id: uuid.UUID) -> list:
    """Riwayat perubahan rate card per komponen (FR-7.2)."""
    from app.modules.gudang.models import RateCardChange

    _get_or_raise_component(db, component_id)
    stmt = (
        select(RateCardChange)
        .where(RateCardChange.order_component_id == component_id)
        .order_by(RateCardChange.changed_at.desc())
    )
    return list(db.scalars(stmt).all())


def assemble_order(
    db: Session,
    order_id: uuid.UUID,
    qty_assembled: int,
    assembler_id: uuid.UUID | None = None,
    notes: str | None = None,
):
    """Rakit komponen menjadi produk utuh → order SEWING → MENUNGGU_QC (FR-7.3/7.4).

    Qty rakit tidak boleh melebihi total output terverifikasi order.
    """
    from app.modules.gudang.models import AssemblyBatch

    order = _get_or_raise_order(db, order_id)
    if order.status != OrderStatus.SEWING:
        raise OrderStatusTransitionError(
            order.status.value, "MENUNGGU_QC (rakit hanya dari status SEWING)"
        )
    if qty_assembled <= 0:
        raise InvalidOutputQuantityError(qty_assembled)
    verified = db.scalar(
        select(sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0)).where(
            ProductionOutput.order_id == order_id, ProductionOutput.is_verified.is_(True)
        )
    ) or 0
    if qty_assembled > int(verified):
        raise ValueError(
            f"Qty rakit ({qty_assembled}) melebihi output terverifikasi ({int(verified)})."
        )
    batch = AssemblyBatch(
        order_id=order.id,
        client_id=order.client_id,
        qty_assembled=qty_assembled,
        assembled_by_user_id=assembler_id,
        notes=notes,
    )
    db.add(batch)
    order.status = OrderStatus.MENUNGGU_QC
    db.commit()
    db.refresh(batch)
    return batch


def list_assemblies(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> list:
    from app.modules.gudang.models import AssemblyBatch

    stmt = select(AssemblyBatch).order_by(AssemblyBatch.assembled_at.desc())
    if client_id is not None:
        stmt = stmt.where(AssemblyBatch.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(AssemblyBatch.order_id == order_id)
    return list(db.scalars(stmt).all())


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


def get_worker_dashboard_summary(
    db: Session,
    operator_user_id: uuid.UUID,
) -> WorkerDashboardResponse:
    """Ringkasan order aktif, output, dan hasil QC yang bisa diatribusikan ke Penjahit."""
    outputs = list(
        db.scalars(
            select(ProductionOutput)
            .join(Order, Order.id == ProductionOutput.order_id)
            .options(selectinload(ProductionOutput.order))
            .where(
                ProductionOutput.operator_user_id == operator_user_id,
                Order.status != OrderStatus.COMPLETED,
            )
            .order_by(Order.order_number, ProductionOutput.time_window.desc())
        ).all()
    )

    order_summaries: dict[uuid.UUID, dict] = {}
    output_ids = []
    for output in outputs:
        output_ids.append(output.id)
        order = output.order
        summary = order_summaries.setdefault(
            order.id,
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "target_quantity": order.target_quantity,
                "start_date": order.start_date,
                "deadline": order.deadline,
                "own_output_qty": 0,
                "own_verified_qty": 0,
                "qc_passed_qty": 0,
                "qc_repair_qty": 0,
                "qc_defect_qty": 0,
            },
        )
        summary["own_output_qty"] += output.qty_completed
        if output.is_verified:
            summary["own_verified_qty"] += output.qty_completed

    unattributed_qc_inspections = 0
    if order_summaries:
        unattributed_qc_inspections = int(
            db.scalar(
                select(sa_func.count(QCInspection.id)).where(
                    QCInspection.order_id.in_(list(order_summaries)),
                    QCInspection.production_output_id.is_(None),
                )
            )
            or 0
        )

    if output_ids:
        inspections = db.scalars(
            select(QCInspection)
            .where(QCInspection.production_output_id.in_(output_ids))
            .order_by(QCInspection.inspected_at.desc(), QCInspection.id.desc())
        ).all()

        latest_inspected_outputs: set[uuid.UUID] = set()
        qc_field_by_status = {
            QCStatus.LOLOS: "qc_passed_qty",
            QCStatus.REPAIR: "qc_repair_qty",
            QCStatus.DEFECT: "qc_defect_qty",
        }
        summaries_by_output_id = {
            output.id: order_summaries[output.order_id] for output in outputs
        }
        order_id_by_output_id = {
            output.id: output.order_id for output in outputs
        }
        for inspection in inspections:
            output_id = inspection.production_output_id
            if (
                output_id not in order_id_by_output_id
                or inspection.order_id != order_id_by_output_id[output_id]
            ):
                continue
            if output_id in latest_inspected_outputs:
                continue
            latest_inspected_outputs.add(output_id)
            field = qc_field_by_status.get(inspection.status)
            if field:
                summaries_by_output_id[output_id][field] += inspection.qty_inspected

    orders = [
        WorkerDashboardOrderResponse(**summary)
        for summary in sorted(order_summaries.values(), key=lambda item: item["order_number"])
    ]
    return WorkerDashboardResponse(
        total_output_qty=sum(order.own_output_qty for order in orders),
        verified_output_qty=sum(order.own_verified_qty for order in orders),
        qc_passed_qty=sum(order.qc_passed_qty for order in orders),
        qc_repair_qty=sum(order.qc_repair_qty for order in orders),
        qc_defect_qty=sum(order.qc_defect_qty for order in orders),
        unattributed_qc_inspections=unattributed_qc_inspections,
        orders=orders,
    )


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


def get_operator_leaderboard(db: Session, limit: int = 20) -> list[dict]:
    """Peringkat kinerja penjahit: total & terverifikasi pcs per operator."""
    from app.modules.auth.models import User

    rows = db.execute(
        select(
            ProductionOutput.operator_user_id,
            sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0),
        )
        .group_by(ProductionOutput.operator_user_id)
        .order_by(sa_func.sum(ProductionOutput.qty_completed).desc())
        .limit(limit)
    ).all()
    verified_rows = dict(
        db.execute(
            select(
                ProductionOutput.operator_user_id,
                sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0),
            )
            .where(ProductionOutput.is_verified.is_(True))
            .group_by(ProductionOutput.operator_user_id)
        ).all()
    )
    board = []
    for user_id, total in rows:
        user = db.scalar(select(User).where(User.id == user_id))
        board.append(
            {
                "user_id": user_id,
                "name": user.name if user else "Operator",
                "total_qty": int(total or 0),
                "verified_qty": int(verified_rows.get(user_id, 0)),
            }
        )
    board.sort(key=lambda e: e["verified_qty"], reverse=True)
    return board
