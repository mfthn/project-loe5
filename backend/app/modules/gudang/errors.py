"""Error khusus modul Gudang dan Anti-Kontaminasi Silang."""
import uuid


class CrossContaminationError(ValueError):
    """Exception yang dilempar saat bahan Klien A dicoba dikeluarkan untuk Order Klien B."""

    def __init__(
        self,
        item_id: uuid.UUID,
        item_client_id: uuid.UUID,
        order_id: uuid.UUID,
        order_client_id: uuid.UUID,
        material_name: str,
        order_number: str,
    ) -> None:
        self.item_id = item_id
        self.item_client_id = item_client_id
        self.order_id = order_id
        self.order_client_id = order_client_id
        self.material_name = material_name
        self.order_number = order_number
        message = (
            f"BLOKIR KONTAMINASI SILANG: Bahan '{material_name}' (Milik Klien: {item_client_id}) "
            f"TIDAK BOLEH dikeluarkan untuk Pesanan '{order_number}' (Milik Klien: {order_client_id}). "
            f"Sistem membatalkan transaksi sebelum stok berkurang."
        )
        super().__init__(message)
