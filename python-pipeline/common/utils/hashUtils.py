"""
hashUtils.py
Module A utility:
- 의미 없는 안정적 ID 생성
- 중복 판단용 해시
- 판단/해석 없음
"""

import hashlib
import json
from typing import Any, Dict


# =========================
# Core Hash Utils
# =========================

def sha256_hash(value: str) -> str:
    """
    가장 기본적인 문자열 해시
    """
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_from_fields(fields: Dict[str, Any]) -> str:
    """
    여러 필드를 묶어서 안정적인 해시 생성
    - key 순서 고정
    - 값만으로 판단
    """
    normalized = json.dumps(
        fields,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":")
    )
    return sha256_hash(normalized)


# =========================
# High-level Helpers
# =========================

def generate_item_hash(
    source: str,
    url: str,
    title: str = "",
    published_at: str = ""
) -> str:
    """
    원천 아이템 식별용 해시
    - 의미 판단 ❌
    - 재수집 시 동일 ID 보장 ⭕
    """
    base = {
        "source": source,
        "url": url,
        "title": title.strip()[:200],
        "published_at": published_at or ""
    }
    return hash_from_fields(base)


def generate_cluster_hash(item_ids: list) -> str:
    """
    클러스터 구성 기반 해시
    - cluster 안정성 체크용
    """
    return hash_from_fields({
        "item_ids": sorted(item_ids)
    })


def generate_embedding_hash(text: str, model: str) -> str:
    """
    embedding 결과 캐싱/재사용용
    """
    return hash_from_fields({
        "model": model,
        "text": text.strip()
    })


# =========================
# Dedup Helper
# =========================

def is_duplicate(existing_hashes: set, new_hash: str) -> bool:
    """
    중복 여부 판단 (판단 로직 아님, 단순 포함 체크)
    """
    return new_hash in existing_hashes
