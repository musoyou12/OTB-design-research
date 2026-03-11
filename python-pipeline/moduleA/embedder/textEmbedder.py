"""
textEmbedder.py

Module A - Embedder
- chunk_text → OpenAI text-embedding-3-small (1536차원)
- pgvector 스키마와 차원 일치
- 해석 / 요약 / 분류 금지

배치 처리로 API 호출 최소화 (최대 100개/배치)
"""

import os
import time
from typing import List, Dict

from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

MODEL = "text-embedding-3-small"
BATCH_SIZE = 100


def embed_chunks(chunks: List[Dict]) -> List[Dict]:
    """
    청크 리스트에 embedding 필드 추가하여 반환
    chunks: [{ reference_id, chunk_index, chunk_text }, ...]
    returns: [{ ..., embedding: List[float] }, ...]
    """
    results = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i: i + BATCH_SIZE]
        texts = [c["chunk_text"] for c in batch]

        try:
            response = client.embeddings.create(
                model=MODEL,
                input=texts,
            )
            for chunk, data in zip(batch, response.data):
                results.append({
                    **chunk,
                    "embedding": data.embedding,
                })
            print(f"[EMBED] batch {i // BATCH_SIZE + 1}: {len(batch)} chunks embedded")

        except Exception as e:
            print(f"[EMBED] batch {i // BATCH_SIZE + 1} failed: {e}")
            # 실패한 배치는 embedding None으로 기록 (저장 시 skip)
            for chunk in batch:
                results.append({**chunk, "embedding": None})

        # API rate limit 여유
        time.sleep(0.5)

    return results
