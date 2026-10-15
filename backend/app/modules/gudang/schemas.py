"""Skema Pydantic untuk modul Gudang Multi-Tenant & Anti-Kontaminasi Silang."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.gudang.models import RequestStatus, TransactionType


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
    storage_location: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StorageLocationUpdate(BaseModel):
    storage_location: str = Field(..., min_length=1, max_length=100)


class MaterialReceiptRequest(BaseModel):
    """Permintaan penerimaan bahan masuk (Transaksi IN)."""
    inventory_item_id: uuid.UUID = Field(..., description="ID item bahan baku di gudang")
    quantity: float = Field(..., gt=0.0, description="Jumlah bahan yang diterima (harus > 0)")
    order_id: uuid.UUID | None = Field(None, description="ID Pesanan terkait (jika sudah ada pesanan spesifik)")
    po_id: uuid.UUID | None = Field(
        None,
        description="ID PO yang dirujuk (wajib jika order_id diisi — penerimaan menunjuk PO yang disetujui)",
    )
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


class MaterialRequestCreate(BaseModel):
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty_requested: float = Field(..., gt=0.0)
    notes: str | None = None


class MaterialRequestReview(BaseModel):
    approve: bool
    notes: str | None = None


class MaterialRequestResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    client_id: uuid.UUID
    qty_requested: float
    qty_fulfilled: float
    status: RequestStatus
    requested_by_user_id: uuid.UUID | None
    reviewed_by_user_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class HandoverCreate(BaseModel):
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    quantity: float = Field(..., gt=0.0)
    material_request_id: uuid.UUID | None = None
    notes: str | None = None


class StockAdjustRequest(BaseModel):
    """Stok opname: koreksi selisih fisik vs sistem (delta bisa + / -)."""
    inventory_item_id: uuid.UUID
    delta: float = Field(..., description="Selisih koreksi; + tambah, - kurang, tidak boleh 0")
    notes: str = Field(..., min_length=3, description="Berita acara opname (wajib untuk audit)")


class CuttingCreate(BaseModel):
    """Catat hasil cutting massal satu hamparan."""
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID | None = None
    qty_lapis: float = Field(..., gt=0, description="Jumlah lembar lapis kain")
    qty_potong_hasil: int = Field(..., gt=0, description="Pcs hasil potong")
    waste_qty: float = Field(default=0.0, ge=0.0, description="Sisa waste (satuan item)")
    waste_category: str | None = Field(
        None, description="Kategori waste FR-6.3: SISA_POTONG / SCRAP / BS_REJECT"
    )
    notes: str | None = None


class CuttingResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID | None
    client_id: uuid.UUID
    qty_lapis: float
    qty_potong_hasil: int
    waste_qty: float
    waste_category: str | None = None
    cut_by_user_id: uuid.UUID | None
    notes: str | None
    cut_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HandoverResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    material_request_id: uuid.UUID | None
    transaction_id: uuid.UUID | None
    client_id: uuid.UUID
    quantity: float
    handed_by_user_id: uuid.UUID | None
    received_by_user_id: uuid.UUID | None
    handed_at: datetime
    received_at: datetime | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)
