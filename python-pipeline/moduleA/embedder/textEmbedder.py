"""
textEmbedder.py

Module A - Embedder
- chunk_text → OpenAI text-embedding-3-small (1536차원)
- pgvector 스키마와 차원 일치
- 해석 / 요약 / 분류 금지

배치 처리로 API 호출 최소화 (최대 100개/배치)
"""

import hashlib
import os
from typing import List, Dict

from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

MODEL = "text-embedding-3-small"
BATCH_SIZE = 100


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def embed_chunks(chunks: List[Dict], existing_hashes: set = None) -> List[Dict]:
    """
    청크 리스트에 embedding 필드 추가하여 반환.
    existing_hashes: 이미 DB에 저장된 chunk_text 해시 집합 → 중복 API 호출 스킵.

    chunks: [{ reference_id, chunk_index, chunk_text }, ...]
    returns: [{ ..., embedding: List[float], chunk_hash: str }, ...]
    """
    if existing_hashes is None:
        existing_hashes = set()

    # 중복 스킵: 이미 임베딩된 청크는 embedding=None 으로 패스스루
    to_embed, skipped = [], []
    for chunk in chunks:
        h = _text_hash(chunk["chunk_text"])
        if h in existing_hashes:
            skipped.append({**chunk, "embedding": None, "chunk_hash": h, "_skipped": True})
        else:
            to_embed.append({**chunk, "chunk_hash": h})

    if skipped:
        print(f"[EMBED] {len(skipped)} chunks skipped (already embedded)")

    results = list(skipped)

    for i in range(0, len(to_embed), BATCH_SIZE):
        batch = to_embed[i: i + BATCH_SIZE]
        texts = [c["chunk_text"] for c in batch]

        try:
            response = client.embeddings.create(model=MODEL, input=texts)
            for chunk, data in zip(batch, response.data):
                results.append({**chunk, "embedding": data.embedding})
            print(f"[EMBED] batch {i // BATCH_SIZE + 1}: {len(batch)} chunks embedded")

        except Exception as e:
            print(f"[EMBED] batch {i // BATCH_SIZE + 1} failed: {e}")
            for chunk in batch:
                results.append({**chunk, "embedding": None})

    return results
