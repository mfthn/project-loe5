"""Error khusus modul Finance (PO & Invoice)."""
import uuid


class PONotFoundError(ValueError):
    def __init__(self, po_id: uuid.UUID) -> None:
        super().__init__(f"Purchase order {po_id} tidak ditemukan.")


class PONumberDuplicateError(ValueError):
    def __init__(self, po_number: str) -> None:
        super().__init__(f"Nomor PO '{po_number}' sudah dipakai. Gunakan nomor yang berbeda.")


class POTransitionError(ValueError):
    def __init__(self, current: str, action: str) -> None:
        super().__init__(
            f"PO berstatus {current} tidak bisa {action}. "
            "Alur: DRAFT → DISETUJUI → DITERIMA_SEBAGIAN → SELESAI."
        )


class InvoiceNotFoundError(ValueError):
    def __init__(self, invoice_id: uuid.UUID) -> None:
        super().__init__(f"Invoice {invoice_id} tidak ditemukan.")


class InvoiceNumberDuplicateError(ValueError):
    def __init__(self, invoice_number: str) -> None:
        super().__init__(f"Nomor invoice '{invoice_number}' sudah dipakai. Gunakan nomor yang berbeda.")


class InvoiceOrderError(ValueError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvoicePaymentError(ValueError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
