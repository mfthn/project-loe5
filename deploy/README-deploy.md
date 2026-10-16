# Deploy Eksternal (EC2) — Backend + Bot Telegram 24/7

Tujuan: bot `@lukla2567_bot` bisa diakses siapa pun kapan pun, tanpa bergantung ke laptop.

## 1. Siapkan server (Ubuntu 22.04, SG buka 22 + 8000 + 3000)

```bash
sudo apt update && sudo apt install -y python3.12-venv postgresql nodejs npm git
git clone <repo-url> ~/project-loe5 && cd ~/project-loe5
```

## 2. Backend

```bash
cd ~/project-loe5/backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # lalu ISI manual: DATABASE_URL, AUTH_SECRET, kredensial AWS, TELEGRAM_*
# .env JANGAN pernah di-commit (sudah di-ignore git)
.venv/bin/alembic upgrade head && .venv/bin/python scripts/seed.py
```

## 3. Pasang service systemd (backend + bot)

```bash
sudo cp ~/project-loe5/deploy/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now loe-backend loe-telegrambot
systemctl status loe-backend loe-telegrambot   # pastikan active (running)
journalctl -u loe-telegrambot -f               # lihat log bot
```

## 4. Frontend (opsi)

- Opsi A (mudah): deploy folder `frontend/` ke Vercel, set `NEXT_PUBLIC_API_URL=http://<IP-EC2>:8000/api/v1`.
- Opsi B: di EC2 yang sama — `npm install && npm run build`, jalankan `npm start -- -H 0.0.0.0 -p 3000` (bisa dijadikan service ketiga).

## 5. Cek eksternal

- `http://<IP-EC2>:8000/docs` → 200
- Chat `@lukla2567_bot` dari HP akun lain (bukan admin) → wajib dibalas
- `/owner ...` dari akun tak terdaftar → wajib ditolak

## Catatan

- Token BotFather + password service account hanya ada di `backend/.env` server, tidak ikut repo.
- Ganti `<repo-url>`, user `ubuntu`, dan path bila berbeda (sesuaikan file `.service`).
