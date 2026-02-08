"""
deduplicate.py

Module A - Preprocess responsibility:
- 수집된 레퍼런스 중 중복 제거
- URL / 텍스트 해시 기반 deduplication
- 의미 판단, 요약, 분류 금지

Output:
- 중복 제거된 reference list
"""

import hashlib
from typing import List, Dict


# =========================
# Utils
# =========================

def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _build_text(item: Dict) -> str:
    parts = [
        item.get("title", ""),
        item.get("summary", ""),
        item.get("content", "")
    ]
    return " ".join([p.strip() for p in parts if p]).strip()


# =========================
# Core
# =========================

def deduplicate(items: List[Dict]) -> List[Dict]:
    """
    중복 제거된 reference 리스트 반환
    """
    seen_urls = set()
    seen_text_hashes = set()

    unique_items: List[Dict] = []

    for item in items:
        url = item.get("url", "").strip()

        # 1️⃣ URL 기준 중복 제거
        if url:
            if url in seen_urls:
                continue
            seen_urls.add(url)

        # 2️⃣ 텍스트 해시 기준 중복 제거
        text = _build_text(item)
        if text:
            text_hash = _hash_text(text)
            if text_hash in seen_text_hashes:
                continue
            seen_text_hashes.add(text_hash)

        unique_items.append(item)

    return unique_items
