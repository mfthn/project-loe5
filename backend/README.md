# Backend project-loe5 (FastAPI)

Lihat README utama di folder root untuk langkah setup lengkap.

Perintah cepat, dijalankan dari folder `backend` dengan virtual environment aktif:

```bash
uvicorn app.main:app --reload                 # API di http://localhost:8000
pytest                                        # pengujian
ruff check .                                  # pemeriksaan gaya kode
alembic revision --autogenerate -m "pesan"    # membuat migrasi baru
alembic upgrade head                          # menerapkan migrasi
```
