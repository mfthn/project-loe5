"""Error khusus modul Quality Control & Manajemen Defect (FR-9, FR-10.3)."""
import uuid


class InspectionNotFoundError(ValueError):
    def __init__(self, inspection_id: uuid.UUID) -> None:
        super().__init__(f"Inspeksi QC dengan ID {inspection_id} tidak ditemukan.")
        self.inspection_id = inspection_id


class OrderNotInQCStatusError(ValueError):
    """Order tidak dalam status MENUNGGU_QC atau QC sehingga tidak bisa diinspeksi."""
    def __init__(self, order_id: uuid.UUID, current_status: str) -> None:
        super().__init__(
            f"Order {order_id} saat ini berstatus '{current_status}'. "
            "Inspeksi QC hanya dapat dilakukan saat status MENUNGGU_QC atau QC."
        )
        self.order_id = order_id
        self.current_status = current_status


class InvalidQCQuantityError(ValueError):
    """Jumlah pcs yang diinspeksi tidak valid."""
    def __init__(self, qty: int) -> None:
        super().__init__(f"Jumlah pcs yang diinspeksi harus lebih dari 0, diterima: {qty}.")
        self.qty = qty


class QCBonusPoolEmptyError(ValueError):
    """Pool bonus QC kosong — belum ada produk yang lolos QC untuk order ini."""
    def __init__(self, order_id: uuid.UUID) -> None:
        super().__init__(
            f"Pool bonus QC untuk order {order_id} masih kosong (0 pcs lolos). "
            "Pastikan sudah ada inspeksi dengan status LOLOS sebelum membagi bonus."
        )
        self.order_id = order_id


class NoBonusRecipientsError(ValueError):
    """Tidak ada penerima bonus QC yang terdaftar (Mandor + Kepala Ops)."""
    def __init__(self) -> None:
        super().__init__(
            "Tidak ditemukan penerima bonus QC (MANDOR / Kepala Operasional) di sistem. "
            "Pastikan data pengguna dengan peran MANDOR sudah disiapkan."
        )
