"""Pemanggilan AWS untuk RAG: S3 (dokumen), Bedrock embedding (Titan), dan Bedrock LLM (Nova Lite).

Hanya file ini yang memakai boto3 untuk RAG. Kredensial diambil dari default credential chain
AWS (aws configure, profile, atau IAM role), tidak ditulis di kode maupun di .env.
"""
import json
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings
from app.modules.ai.errors import RagUpstreamError

logger = logging.getLogger(__name__)

_AWS_HINT = "Periksa kredensial AWS, region, izin IAM, dan akses model di konsol Bedrock."


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
            raise RagUpstreamError(f"Gagal membaca dokumen dari S3. {_AWS_HINT}") from e

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
            raise RagUpstreamError(f"Gagal membaca daftar dokumen dari S3. {_AWS_HINT}") from e

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
                    f"Gagal membaca dokumen {key} dari S3. {_AWS_HINT}"
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
            raise RagUpstreamError(f"Gagal membuat embedding di Bedrock. {_AWS_HINT}") from e

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
            raise RagUpstreamError(f"Gagal memanggil model LLM di Bedrock. {_AWS_HINT}") from e

        blocks = resp["output"]["message"]["content"]
        return "".join(block.get("text", "") for block in blocks).strip()
