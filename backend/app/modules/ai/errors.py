"""Error domain untuk RAG. Router yang menerjemahkannya ke kode HTTP."""


class RagError(Exception):
    """Dasar semua error RAG."""


class RagNotConfiguredError(RagError):
    """Konfigurasi belum lengkap, misalnya S3_BUCKET belum diisi."""


class RagUnavailableError(RagError):
    """Index tidak bisa dibangun karena kondisi data, misalnya dokumen di S3 kosong."""


class RagUpstreamError(RagError):
    """Pemanggilan layanan AWS (S3 atau Bedrock) gagal."""
