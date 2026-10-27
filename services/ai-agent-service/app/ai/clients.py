"""Provider klien untuk RAG & Chatbot:
1. Local Knowledge Base Docs Reader
2. Fast Term-Frequency Vector Embedding
3. Gemini API / Context-aware Heuristic Generator
"""
import glob
import hashlib
import logging
import math
import os
import re
from app.core.config import Settings

logger = logging.getLogger(__name__)


class FreeRagClients:
    """Implementasi klien RAG mandiri berbasis knowledge base dokumen dan Gemini API."""

    def __init__(self, settings: Settings) -> None:
        self._s = settings
        # Deteksi path docs lokal dengan fallback cerdas agar jalan di lokal maupun cloud deployment
        candidates = [
            os.path.abspath(settings.docs_local_path),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", settings.docs_local_path)),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "docs")),
            os.path.abspath(os.path.join(os.getcwd(), "data", "docs")),
            os.path.abspath(os.path.join(os.getcwd(), "services", "ai-agent-service", "data", "docs")),
        ]
        self.docs_path = candidates[0]
        for p in candidates:
            if os.path.isdir(p) and glob.glob(os.path.join(p, "*.md")):
                self.docs_path = p
                break

    def read_documents(self) -> dict[str, str]:
        """Membaca seluruh dokumen SOP markdown dari folder lokal data/docs/."""
        if not os.path.exists(self.docs_path):
            return {}

        docs: dict[str, str] = {}
        files = glob.glob(os.path.join(self.docs_path, "*.md"))
        for fpath in sorted(files):
            fname = os.path.basename(fpath)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        docs[fname] = content
            except Exception as e:
                logger.warning("Gagal membaca file lokal %s: %s", fname, e)
        return docs

    def documents_fingerprint(self) -> str:
        """Hash isi seluruh dokumen lokal agar vector cache auto-refresh saat file diedit."""
        h = hashlib.sha256()
        docs = self.read_documents()
        for k in sorted(docs.keys()):
            h.update(k.encode())
            h.update(docs[k].encode())
        return h.hexdigest()

    def embed(self, text: str) -> list[float]:
        """Free deterministic semantic-hash embedding (dimensi 128).

        Menghitung representasi frekuensi kata & n-gram lokal tanpa biaya API eksternal.
        """
        dim = 128
        vec = [0.0] * dim
        words = re.findall(r"\w+", text.lower())
        if not words:
            return vec

        for word in words:
            # Hash kata ke indeks dimensi
            idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % dim
            vec[idx] += 1.0

        # Normalisasi vektor L2
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def converse(self, system_prompt: str, user_text: str) -> str:
        """LLM Generator: Jika ada GEMINI_API_KEY gunakan Google Gemini (google-genai SDK),

        jika tidak, gunakan Natural Language Context Heuristic Generator lokal.
        """
        gemini_key = self._s.gemini_api_key.strip()
        if gemini_key:
            try:
                import google.genai as genai
                from concurrent.futures import ThreadPoolExecutor
                from concurrent.futures import TimeoutError as FuturesTimeout

                client = genai.Client(api_key=gemini_key)
                prompt = f"{system_prompt}\n\nPertanyaan/Permintaan:\n{user_text}"

                def _call():
                    models = ["gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
                    for m in models:
                        try:
                            resp = client.models.generate_content(
                                model=m,
                                contents=prompt,
                            )
                            if resp.text:
                                return resp.text.strip()
                        except Exception as m_err:
                            logger.warning("Gemini model %s error: %s, trying fallback", m, m_err)
                    return ""

                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(_call)
                    try:
                        res_text = future.result(timeout=30)
                        if res_text:
                            return res_text
                    except FuturesTimeout:
                        logger.warning("Gemini timeout (>30s), fallback to heuristic")
                    except Exception as inner_e:
                        logger.warning("Gemini call error, fallback: %s", inner_e)
            except Exception as e:
                logger.warning("Gemini setup error: %s", e)

        # Fallback Heuristik Lokal Cerdas berbasis Konteks yang diberikan
        return self._generate_local_heuristic(system_prompt, user_text)

    def converse_stream(self, system_prompt: str, user_text: str):
        """Streaming jawaban kalimat demi kalimat."""
        full_text = self.converse(system_prompt, user_text)
        # Pisahkan per kata/potongan untuk efek streaming yang mulus
        tokens = re.split(r"(\s+)", full_text)
        for token in tokens:
            if token:
                yield token

    def _generate_local_heuristic(self, system_prompt: str, user_text: str) -> str:
        """Pembangkit jawaban lokal yang cerdas membaca prompt & data live/SOP."""
        # Ekstrak bagian konteks dari user_text jika ada
        context = ""
        query = user_text
        if "Konteks Dokumen:" in user_text:
            parts = user_text.split("Konteks Dokumen:")
            query = parts[0].replace("Pertanyaan:", "").strip()
            context = parts[1].strip()
        elif "KONTEKS OPERASIONAL:" in user_text:
            parts = user_text.split("KONTEKS OPERASIONAL:")
            query = parts[0].replace("Pertanyaan:", "").strip()
            context = parts[1].strip()

        # Jika ada data live database (Owner Tracker)
        if "Owner Tracker" in system_prompt or "data operasional" in system_prompt.lower():
            if context:
                # Ringkas data live yang ditemukan untuk Owner
                return (
                    f"Halo, berikut laporan pemantauan operasional terbaru:\n\n"
                    f"{context[:1500]}\n\n"
                    f"Semua data di atas diambil langsung dari pencatatan real-time sistem pabrik. "
                    f"Ada bagian pesanan atau status lain yang ingin diperiksa lebih detail?"
                )
            return (
                "Halo! Saat ini sistem siap memantau progres pesanan, QC, gudang, maupun payroll. "
                "Silakan tanyakan detail nomor order, status sample, atau stok bahan yang ingin dicek."
            )

        # Jika untuk Asisten Calon Klien
        if context:
            # Ambil paragraf terpenting dari konteks SOP
            lines = [line.strip() for line in context.split("\n") if line.strip() and not line.startswith("#")]
            summary = "\n".join(lines[:6]) if lines else context[:600]
            return (
                f"Halo! Terkait pertanyaan Anda mengenai kerja sama produksi di Lukla Manufacturing:\n\n"
                f"{summary}\n\n"
                f"Apakah ada hal lain seputar spesifikasi produk, bahan baku, atau alur kerja sama yang ingin Anda tanyakan?"
            )

        return (
            "Halo! Lukla Manufacturing melayani maklon produksi tas dan garmen dengan berbagai skema kerja sama "
            "(CMT, Semi-CMT, dan Full Package). Silakan tanyakan seputar alur produksi, pengajuan sampel, atau standar bahan baku kami."
        )
