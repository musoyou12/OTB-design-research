"""
documentChunker.py

Module A - Chunker
- 레퍼런스 본문을 임베딩 단위로 분할
- 의미 해석 / 요약 / 분류 금지
- 단순 텍스트 분할만 수행

Chunk strategy:
- 최대 500자 단위
- 200자 오버랩
- 최소 50자 이하 청크는 버림
"""

from typing import List, Dict


CHUNK_SIZE = 500
CHUNK_OVERLAP = 200
MIN_CHUNK_LEN = 50


def _split_text(text: str) -> List[str]:
    chunks = []
    start = 0
    length = len(text)

    while start < length:
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_LEN:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


def chunk_item(item: Dict) -> List[Dict]:
    """
    레퍼런스 1개 → 청크 리스트
    각 청크는 reference_id + chunk_index + chunk_text 포함
    """
    full_text = " ".join(filter(None, [
        item.get("title", ""),
        item.get("body_text", ""),
    ])).strip()

    if not full_text:
        return []

    raw_chunks = _split_text(full_text)

    return [
        {
            "reference_id": item["id"],
            "chunk_index": i,
            "chunk_text": chunk,
        }
        for i, chunk in enumerate(raw_chunks)
    ]


def chunk_items(items: List[Dict]) -> List[Dict]:
    all_chunks = []
    for item in items:
        all_chunks.extend(chunk_item(item))
    return all_chunks
