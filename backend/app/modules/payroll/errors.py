"""Error khusus modul Payroll Engine & Penguncian Transaksi (FR-10, FR-10.1, FR-10.2)."""
import uuid
from datetime import date


class PayrollRunNotFoundError(ValueError):
    def __init__(self, run_id: uuid.UUID) -> None:
        super().__init__(f"Payroll run dengan ID {run_id} tidak ditemukan.")
        self.run_id = run_id


class PayrollRunLockedError(ValueError):
    """Operasi ditolak karena payroll run sudah dikunci (is_locked = True)."""
    def __init__(self, run_id: uuid.UUID) -> None:
        super().__init__(
            f"Payroll run {run_id} sudah dikunci (LOCKED) dan tidak dapat diubah. "
            "Kunci payroll bersifat permanen untuk menjaga integritas data audit."
        )
        self.run_id = run_id


class PayrollPeriodOverlapError(ValueError):
    """Periode payroll tumpang tindih dengan run yang sudah ada."""
    def __init__(self, period_start: date, period_end: date) -> None:
        super().__init__(
            f"Periode payroll {period_start} – {period_end} tumpang tindih "
            "dengan payroll run yang sudah ada. Periksa kembali tanggal periode."
        )
        self.period_start = period_start
        self.period_end = period_end


class PayrollDetailNotFoundError(ValueError):
    def __init__(self, detail_id: uuid.UUID) -> None:
        super().__init__(f"Detail payroll dengan ID {detail_id} tidak ditemukan.")
        self.detail_id = detail_id


class NoOutputsForPeriodError(ValueError):
    """Tidak ada data output produksi terverifikasi dalam periode ini."""
    def __init__(self, period_start: date, period_end: date) -> None:
        super().__init__(
            f"Tidak ada log output produksi yang terverifikasi dalam periode "
            f"{period_start} – {period_end}. Pastikan Mandor sudah memverifikasi "
            "output 30 menit sebelum menghitung payroll."
        )
        self.period_start = period_start
        self.period_end = period_end
