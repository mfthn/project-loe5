"""Skema Pydantic untuk modul Gudang Multi-Tenant & Anti-Kontaminasi Silang."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.gudang.models import TransactionType


class InventoryItemCreate(BaseModel):
    client_id: uuid.UUID = Field(..., description="ID Klien pemilik bahan (Wajib untuk isolasi multi-tenant)")
    material_code: str = Field(..., min_length=2, max_length=100, description="Kode material/kain, misal: KAIN-COTTON-24S")
    material_name: str = Field(..., min_length=2, max_length=255, description="Nama material, misal: Cotton Combed 24s Navy")
    initial_stock: float = Field(default=0.0, ge=0.0, description="Stok awal bahan (opsional)")
    unit_measure: str = Field(default="METER", description="Satuan ukuran: METER, YARD, KG, PCS")


class InventoryItemResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    material_code: str
    material_name: str
    current_stock: float
    unit_measure: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialReceiptRequest(BaseModel):
    """Permintaan penerimaan bahan masuk (Transaksi IN)."""
    inventory_item_id: uuid.UUID = Field(..., description="ID item bahan baku di gudang")
    quantity: float = Field(..., gt=0.0, description="Jumlah bahan yang diterima (harus > 0)")
    order_id: uuid.UUID | None = Field(None, description="ID Pesanan terkait (jika sudah ada pesanan spesifik)")
    notes: str | None = Field(None, description="Catatan penerimaan / nomor surat jalan")


class MaterialIssueRequest(BaseModel):
    """Permintaan pengeluaran bahan ke proses Cutting/Produksi (Transaksi OUT)."""
    inventory_item_id: uuid.UUID = Field(..., description="ID item bahan baku yang akan dikeluarkan")
    order_id: uuid.UUID = Field(..., description="ID Pesanan target (Wajib untuk validasi anti-kontaminasi silang)")
    quantity: float = Field(..., gt=0.0, description="Jumlah bahan yang dikeluarkan (harus > 0)")
    notes: str | None = Field(None, description="Catatan keperluan cutting / batch produksi")


class InventoryTransactionResponse(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    client_id: uuid.UUID
    order_id: uuid.UUID | None
    transaction_type: TransactionType
    quantity: float
    transaction_time: datetime
    performed_by_user_id: uuid.UUID | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)
