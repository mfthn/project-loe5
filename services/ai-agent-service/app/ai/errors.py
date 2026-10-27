"""Error domain untuk RAG. Router yang menerjemahkannya ke kode HTTP."""


class RagError(Exception):
    """Dasar semua error RAG."""


class RagNotConfiguredError(RagError):
    """Konfigurasi knowledge base belum lengkap."""


class RagUnavailableError(RagError):
    """Index tidak bisa dibangun karena kondisi data."""


class RagUpstreamError(RagError):
    """Pemanggilan layanan AI gagal."""
