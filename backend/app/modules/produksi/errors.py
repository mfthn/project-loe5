"""Error khusus modul Produksi, Order Massal, dan Terminal 30 Menit (FR-7, FR-8, FR-9)."""
import uuid


class OrderNotFoundError(ValueError):
    def __init__(self, order_id: uuid.UUID) -> None:
        super().__init__(f"Order dengan ID {order_id} tidak ditemukan.")
        self.order_id = order_id


class OrderNumberDuplicateError(ValueError):
    def __init__(self, order_number: str) -> None:
        super().__init__(f"Nomor order '{order_number}' sudah dipakai. Gunakan nomor yang berbeda.")
        self.order_number = order_number


class OrderComponentNotFoundError(ValueError):
    def __init__(self, component_id: uuid.UUID) -> None:
        super().__init__(f"Komponen order dengan ID {component_id} tidak ditemukan.")
        self.component_id = component_id


class OrderStatusTransitionError(ValueError):
    """Transisi status order yang tidak diperbolehkan."""
    def __init__(self, current: str, target: str) -> None:
        super().__init__(
            f"Tidak dapat mengubah status order dari '{current}' ke '{target}'. "
            "Urutan status: SAMPLE → CUTTING → SEWING → MENUNGGU_QC → QC → COMPLETED."
        )
        self.current = current
        self.target = target


class InvalidOutputQuantityError(ValueError):
    """Jumlah output tidak valid (harus > 0)."""
    def __init__(self, qty: int) -> None:
        super().__init__(f"Jumlah output harus lebih dari 0, diterima: {qty}.")
        self.qty = qty


class SampleVersionNotApprovedError(ValueError):
    """Versi sample belum APPROVED sehingga tidak bisa dikonversi ke order massal."""
    def __init__(self, version_id: uuid.UUID) -> None:
        super().__init__(
            f"Versi sample {version_id} belum disetujui (APPROVED). "
            "Approve versi tersebut terlebih dahulu sebelum membuat order massal."
        )
        self.version_id = version_id
