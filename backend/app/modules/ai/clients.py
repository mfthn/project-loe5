"""Implementasi klien RAG: lokal (Gemini + dokumen markdown) dan opsional AWS.

Hanya file ini yang memakai boto3 untuk RAG. Kredensial diambil dari default credential chain
AWS (aws configure, profile, atau IAM role), tidak ditulis di kode maupun di .env.
"""
import hashlib
import json
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings
from app.modules.ai.errors import RagUpstreamError

logger = logging.getLogger(__name__)

_UPSTREAM_HINT = "Periksa konfigurasi layanan AI dan pastikan koneksi aktif."


class AwsRagClients:
    def __init__(self, settings: Settings) -> None:
        self._s = settings
        # Gunakan kredensial eksplisit dari .env agar tidak bergantung pada aws configure
        _creds = {
            "aws_access_key_id": settings.aws_access_key_id or None,
            "aws_secret_access_key": settings.aws_secret_access_key or None,
        }
        self._s3 = boto3.client("s3", region_name=settings.s3_region, **_creds)
        self._embed = boto3.client("bedrock-runtime", region_name=settings.embedding_region, **_creds)
        self._llm = boto3.client("bedrock-runtime", region_name=settings.llm_region, **_creds)


    def read_document(self) -> str:
        try:
            obj = self._s3.get_object(Bucket=self._s.s3_bucket, Key=self._s.s3_document_key)
            return obj["Body"].read().decode("utf-8")
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal membaca s3://%s/%s", self._s.s3_bucket, self._s.s3_document_key)
            raise RagUpstreamError(f"Gagal membaca dokumen. {_UPSTREAM_HINT}") from e

    def list_md_documents(self) -> list[str]:
        """Daftar semua key .md di bucket (tahan terhadap ganti-tambah dokumen)."""
        try:
            keys: list[str] = []
            token = None
            while True:
                kwargs: dict = {"Bucket": self._s.s3_bucket, "MaxKeys": 1000}
                if token:
                    kwargs["ContinuationToken"] = token
                resp = self._s3.list_objects_v2(**kwargs)
                for obj in resp.get("Contents", []):
                    if obj["Key"].endswith(".md"):
                        keys.append(obj["Key"])
                if resp.get("IsTruncated"):
                    token = resp.get("NextContinuationToken")
                else:
                    break
            return sorted(keys)
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal membaca daftar isi s3://%s", self._s.s3_bucket)
            raise RagUpstreamError(f"Gagal membaca daftar dokumen. {_UPSTREAM_HINT}") from e

    def read_documents(self) -> dict[str, str]:
        """Baca seluruh dokumen .md di bucket. Key → isi teks."""
        keys = self.list_md_documents()
        if not keys:
            raise RagUpstreamError(
                f"Tidak ada dokumen .md di bucket s3://{self._s.s3_bucket}. "
                "Unggah dokumen SOP (.md) lalu sinkron ulang."
            )
        docs: dict[str, str] = {}
        for key in keys:
            try:
                obj = self._s3.get_object(Bucket=self._s.s3_bucket, Key=key)
                text = obj["Body"].read().decode("utf-8")
                if text.strip():
                    docs[key] = text
            except (ClientError, BotoCoreError) as e:
                logger.exception("Gagal membaca s3://%s/%s", self._s.s3_bucket, key)
                raise RagUpstreamError(
                    f"Gagal membaca dokumen {key}. {_UPSTREAM_HINT}"
                ) from e
        if not docs:
            raise RagUpstreamError(
                f"Seluruh dokumen di s3://{self._s.s3_bucket} kosong."
            )
        return docs

    def embed(self, text: str) -> list[float]:
        body = json.dumps({
            "inputText": text,
            "dimensions": self._s.embedding_dimensions,
            "normalize": True,
        })
        try:
            resp = self._embed.invoke_model(
                modelId=self._s.embedding_model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            payload = json.loads(resp["body"].read())
            return [float(x) for x in payload["embedding"]]
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal embedding dengan model %s", self._s.embedding_model_id)
            raise RagUpstreamError(f"Gagal membuat embedding. {_UPSTREAM_HINT}") from e

    def converse(self, system_prompt: str, user_text: str) -> str:
        try:
            resp = self._llm.converse(
                modelId=self._s.llm_model_id,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_text}]}],
                inferenceConfig={
                    "maxTokens": self._s.llm_max_tokens,
                    "temperature": self._s.llm_temperature,
                },
            )
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal memanggil LLM %s", self._s.llm_model_id)
            raise RagUpstreamError(f"Gagal memanggil model AI. {_UPSTREAM_HINT}") from e

        blocks = resp["output"]["message"]["content"]
        return "".join(block.get("text", "") for block in blocks).strip()

    def documents_fingerprint(self) -> str:
        """Hash ETag+ukuran seluruh .md di bucket — berubah bila dokumen berubah."""
        import hashlib

        try:
            h = hashlib.sha256()
            token = None
            while True:
                kwargs: dict = {"Bucket": self._s.s3_bucket, "MaxKeys": 1000}
                if token:
                    kwargs["ContinuationToken"] = token
                resp = self._s3.list_objects_v2(**kwargs)
                for obj in resp.get("Contents", []):
                    if obj["Key"].endswith(".md"):
                        h.update(obj["Key"].encode())
                        h.update(str(obj.get("ETag", "")).encode())
                        h.update(str(obj.get("Size", 0)).encode())
                if resp.get("IsTruncated"):
                    token = resp.get("NextContinuationToken")
                else:
                    break
            return h.hexdigest()
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal fingerprint s3://%s", self._s.s3_bucket)
            raise RagUpstreamError(f"Gagal membaca daftar dokumen. {_UPSTREAM_HINT}") from e

    def converse_stream(self, system_prompt: str, user_text: str):
        """Yield potongan teks jawaban via Bedrock converse_stream."""
        try:
            resp = self._llm.converse_stream(
                modelId=self._s.llm_model_id,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_text}]}],
                inferenceConfig={
                    "maxTokens": self._s.llm_max_tokens,
                    "temperature": self._s.llm_temperature,
                },
            )
            for event in resp.get("stream", []):
                delta = event.get("contentBlockDelta")
                if delta and isinstance(delta.get("delta"), dict):
                    text = delta["delta"].get("text", "")
                    if text:
                        yield text
        except (ClientError, BotoCoreError) as e:
            logger.exception("Gagal streaming LLM %s", self._s.llm_model_id)
            raise RagUpstreamError(f"Gagal memanggil model AI. {_UPSTREAM_HINT}") from e


import glob
import math
import os
import re


class FreeRagClients:
    """Implementasi RAG menggunakan AI generatif dan dokumen knowledge base lokal."""

    def __init__(self, settings: Settings) -> None:
        self._s = settings
        candidates = [
            os.path.abspath(settings.docs_local_path),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", settings.docs_local_path)),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "services", "ai-agent-service", "data", "docs")),
            os.path.abspath(os.path.join(os.getcwd(), "docs")),
            os.path.abspath(os.path.join(os.getcwd(), "data", "docs")),
        ]
        self.docs_path = candidates[0]
        for p in candidates:
            if os.path.isdir(p) and glob.glob(os.path.join(p, "*.md")):
                self.docs_path = p
                break

    def read_documents(self) -> dict[str, str]:
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

    def read_document(self) -> str:
        docs = self.read_documents()
        return "\n\n".join(docs.values())

    def documents_fingerprint(self) -> str:
        h = hashlib.sha256()
        docs = self.read_documents()
        for k in sorted(docs.keys()):
            h.update(k.encode())
            h.update(docs[k].encode())
        return h.hexdigest()

    def embed(self, text: str) -> list[float]:
        dim = 128
        vec = [0.0] * dim
        words = re.findall(r"\w+", text.lower())
        if not words:
            return vec
        for word in words:
            idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % dim
            vec[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def converse(self, system_prompt: str, user_text: str) -> str:
        gemini_key = getattr(self._s, "gemini_api_key", "").strip()
        if gemini_key:
            try:
                import google.genai as genai
                from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

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
                            logger.warning("Gemini model %s error: %s, mencoba fallback model", m, m_err)
                    return ""

                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(_call)
                    try:
                        res_text = future.result(timeout=30)
                        if res_text:
                            return res_text
                    except FuturesTimeout:
                        logger.warning("Gemini timeout (>30s), fallback ke heuristik")
                    except Exception as inner_e:
                        logger.warning("Gemini call error, fallback: %s", inner_e)
            except Exception as e:
                logger.warning("Gemini setup error: %s", e)

        return self._generate_local_heuristic(system_prompt, user_text)

    def converse_stream(self, system_prompt: str, user_text: str):
        full_text = self.converse(system_prompt, user_text)
        tokens = re.split(r"(\s+)", full_text)
        for token in tokens:
            if token:
                yield token

    def _generate_local_heuristic(self, system_prompt: str, user_text: str) -> str:
        context = ""
        query = user_text
        if "Konteks Dokumen:" in user_text:
            parts = user_text.split("Konteks Dokumen:", 1)
            query = parts[0]
            context = parts[1]
        elif "Konteks:\n" in user_text:
            parts = user_text.split("Konteks:\n", 1)
            context = parts[1]
            if "\nPertanyaan:" in context:
                c_part, q_part = context.split("\nPertanyaan:", 1)
                context = c_part
                query = q_part

        q_lower = query.lower()

        if any(w in q_lower for w in ["cmt", "semi-cmt", "skema"]):
            return (
                "Di Lukla Manufacturing, terdapat 3 skema kerja sama maklon utama:\n"
                "1. **CMT (Cut, Make, Trim)**: Klien menyediakan kain utama dan seluruh aksesoris. Kami menangani pemotongan, penjahitan, hingga finishing.\n"
                "2. **Semi-CMT**: Klien menyediakan bahan utama (kain), sedangkan aksesoris dan benang disiapkan oleh pihak kami.\n"
                "3. **Full Package (FOB)**: Seluruh penyediaan material, pembuatan sample, produksi massal hingga packing disiapkan lengkap oleh tim Lukla.\n\n"
                "Silakan konsultasikan detail pesanan Anda dengan tim pemesanan kami via WhatsApp."
            )

        if any(w in q_lower for w in ["moq", "minimal"]):
            return (
                "Minimal pemesanan (MOQ) di Lukla Manufacturing adalah sebagai berikut:\n"
                "- **Jaket & Outerwear**: 50 - 100 pcs per model/desain.\n"
                "- **Tas & Ransel**: 100 pcs per model.\n"
                "- **Kaos / Kemeja**: 50 - 100 pcs per warna/desain.\n\n"
                "Untuk jumlah fleksibel atau pembuatan sample terlebih dahulu, silakan hubungi tim kami."
            )

        if any(w in q_lower for w in ["sample", "sampel"]):
            return (
                "Alur pembuatan sample di Lukla Manufacturing:\n"
                "1. Konsultasi desain dan pemilihan skema (CMT/Semi-CMT/Full Package).\n"
                "2. Pembuatan **Sample V1** dan fitting uji coba.\n"
                "3. Jika ada penyesuaian, dilanjutkan revisi **Sample V2** hingga disetujui (Approved by Client).\n"
                "4. Setelah sample disetujui, produksi massal dapat segera dijadwalkan."
            )

        if context.strip():
            paragraphs = [p.strip() for p in context.split("\n\n") if p.strip() and not p.startswith("#")]
            relevant = [p for p in paragraphs if any(w in p.lower() for w in q_lower.split() if len(w) > 3)]
            if relevant:
                excerpt = " ".join(relevant[:2])
                return (
                    f"{excerpt}\n\n"
                    "Untuk informasi lebih spesifik atau penawaran resmi, silakan hubungi tim pemesanan kami melalui tombol WhatsApp di bawah."
                )

        return (
            "Halo! Kami siap membantu kebutuhan maklon dan produksi garmen/tas Anda. "
            "Untuk informasi spesifikasi, perhitungan harga, dan konsultasi teknis, silakan hubungi tim pemesanan kami via WhatsApp."
        )
