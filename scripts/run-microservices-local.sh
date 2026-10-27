#!/usr/bin/env bash
# ==============================================================================
# Script Menjalankan Seluruh Microservices di Mesin Lokal (Tanpa Docker)
# Setiap service menggunakan virtual environment-nya sendiri.
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Fungsi: setup venv + install requirements jika belum ada
setup_service() {
    local name="$1"
    local dir="$ROOT_DIR/services/$name"
    local venv="$dir/.venv"
    local req="$dir/requirements.txt"

    if [ ! -d "$venv" ]; then
        echo "  [setup] Membuat venv untuk $name ..."
        python3 -m venv "$venv"
    fi

    # Selalu install/update dependencies
    if [ -f "$req" ]; then
        echo "  [setup] Menginstall dependencies $name ..."
        "$venv/bin/pip" install -q -r "$req"
        # Pastikan email-validator dan python-multipart
        "$venv/bin/pip" install -q "pydantic[email]" "email-validator" "python-multipart" 2>/dev/null || true
    fi
}

echo "=========================================================="
echo " Starting Lukla Manufacturing Engine (Microservices Mode)"
echo "=========================================================="
echo ""

# Setup semua service
echo "[Setup] Menyiapkan virtual environments & dependencies..."
setup_service "auth-service"
setup_service "manufacturing-service"
setup_service "finance-service"
setup_service "ai-agent-service"
echo "[Setup] Selesai."
echo ""

# 1. Auth Service (Port 8001)
echo "[1/4] Menjalankan Auth Service pada http://127.0.0.1:8001 ..."
(cd "$ROOT_DIR/services/auth-service" && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload) &
PID_AUTH=$!

# 2. Manufacturing Service (Port 8002)
echo "[2/4] Menjalankan Manufacturing Service pada http://127.0.0.1:8002 ..."
(cd "$ROOT_DIR/services/manufacturing-service" && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload) &
PID_MFG=$!

# 3. Finance Service (Port 8003)
echo "[3/4] Menjalankan Finance Service pada http://127.0.0.1:8003 ..."
(cd "$ROOT_DIR/services/finance-service" && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload) &
PID_FIN=$!

# 4. AI Agent Service (Port 8004)
echo "[4/4] Menjalankan AI Agent Service pada http://127.0.0.1:8004 ..."
(cd "$ROOT_DIR/services/ai-agent-service" && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload) &
PID_AI=$!

trap "echo 'Menghentikan seluruh microservices...'; kill $PID_AUTH $PID_MFG $PID_FIN $PID_AI 2>/dev/null" SIGINT SIGTERM EXIT

echo ""
echo "Semua service backend berjalan!"
echo "  Auth:          http://127.0.0.1:8001/docs"
echo "  Manufacturing: http://127.0.0.1:8002/docs"
echo "  Finance:       http://127.0.0.1:8003/docs"
echo "  AI Agent:      http://127.0.0.1:8004/docs"
echo ""
echo "Tekan Ctrl+C untuk menghentikan semua service."
wait
