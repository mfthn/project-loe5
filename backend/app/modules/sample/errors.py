"""Error khusus modul Sample & Time Study Tracker (FR-3, FR-4)."""
import uuid


class SampleNotFoundError(ValueError):
    """Sample dengan ID yang diminta tidak ditemukan."""

    def __init__(self, sample_id: uuid.UUID) -> None:
        super().__init__(f"Sample dengan ID {sample_id} tidak ditemukan.")
        self.sample_id = sample_id


class SampleVersionNotFoundError(ValueError):
    """Versi sample dengan ID yang diminta tidak ditemukan."""

    def __init__(self, version_id: uuid.UUID) -> None:
        super().__init__(f"Versi sample dengan ID {version_id} tidak ditemukan.")
        self.version_id = version_id


class SampleAlreadyApprovedError(ValueError):
    """Operasi ditolak karena versi sample sudah disetujui (APPROVED)."""

    def __init__(self, version_id: uuid.UUID) -> None:
        super().__init__(
            f"Versi sample {version_id} sudah berstatus APPROVED dan tidak dapat diubah. "
            "Buat versi revisi baru jika diperlukan perubahan."
        )
        self.version_id = version_id


class SampleCodeDuplicateError(ValueError):
    """Kode sample yang diberikan sudah dipakai oleh sample lain."""

    def __init__(self, sample_code: str) -> None:
        super().__init__(f"Kode sample '{sample_code}' sudah dipakai. Gunakan kode yang berbeda.")
        self.sample_code = sample_code
